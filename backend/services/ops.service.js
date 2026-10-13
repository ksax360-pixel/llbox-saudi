const Delivery = require('../models/Delivery');
const Locker = require('../models/Locker');
const Conversation = require('../models/Conversation');
const CallLog = require('../models/CallLog');
const WhatsAppContact = require('../models/WhatsAppContact');
const { HTTP_STATUS } = require('../utils/constants');

const CITIES = ['Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Mecca', 'Medina'];

const cityFromAddress = (address = '') => {
  const found = CITIES.find((city) => String(address).toLowerCase().includes(city.toLowerCase()));
  return found || 'Riyadh';
};

const mapLockerStatus = (raw) => {
  const value = String(raw || '').toLowerCase();
  if (value.includes('deactiv') || value.includes('disabled')) return 'deactivated';
  if (value.includes('maint') || value.includes('offline')) return 'maintenance';
  if (value.includes('in_use') || value.includes('occupied') || value.includes('busy')) return 'in_use';
  return 'available';
};

const pushTimeline = (doc, stage, note) => {
  const last = doc.timeline?.[doc.timeline.length - 1];
  if (last?.stage === stage) return;
  doc.timeline = doc.timeline || [];
  doc.timeline.push({ stage, timestamp: new Date(), note: note || '' });
};

const toLockerDto = (doc) => ({
  id: String(doc._id),
  boxCode: doc.boxCode,
  location: doc.location || doc.boxCode,
  city: doc.city || 'Riyadh',
  latitude: Number(doc.latitude || 24.7136),
  longitude: Number(doc.longitude || 46.6753),
  capacity: Number(doc.capacity || 24),
  occupancy: Number(doc.occupancy || 0),
  status: doc.status,
  lastMaintenance: doc.lastMaintenance ? doc.lastMaintenance.toISOString() : undefined,
  organizationId: doc.organizationId || 'org-1',
});

const toDeliveryDto = (doc) => ({
  id: String(doc._id),
  orderReference: doc.orderReference,
  customerId: doc.customerMobile || String(doc._id),
  customerName: doc.customerName || doc.customerMobile || 'Customer',
  driverId: doc.driverPhone || undefined,
  driverName: doc.driverName || undefined,
  vendor: doc.vendor || 'LLBox',
  lockerId: doc.lockerBoxId ? undefined : undefined,
  lockerCode: doc.lockerCode || undefined,
  sessionId: doc.sessionId || undefined,
  otpStatus: doc.otpStatus,
  status: doc.status,
  city: doc.city || 'Riyadh',
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
  timeline: (doc.timeline || []).map((event) => ({
    stage: event.stage,
    timestamp: new Date(event.timestamp).toISOString(),
    note: event.note || undefined,
  })),
});

class OpsService {
  async upsertLockerFromBox(box = {}) {
    const boxId = Number(box.boxId || box.box_id);
    if (!Number.isFinite(boxId)) return null;

    const status = mapLockerStatus(box.status || box.box_status || box.rawStatus);
    const occupancy = status === 'in_use' ? 1 : 0;
    const location = box.address || box.location || box.boxCode || box.box_code || '';

    const locker = await Locker.findOneAndUpdate(
      { boxId },
      {
        $set: {
          boxCode: box.boxCode || box.box_code || `BOX-${boxId}`,
          location,
          city: cityFromAddress(location),
          latitude: Number(box.latitude || 24.7136),
          longitude: Number(box.longitude || 46.6753),
          capacity: Number(box.capacity || 24),
          occupancy,
          status,
          rawStatus: String(box.status || box.box_status || ''),
          googleMaps: box.googleMaps || box.google_maps_link || '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return locker;
  }

  async recordRegister({ whatsappPhone, orderReference, boxId, boxCode, customerName }) {
    const locker = boxId ? await this.upsertLockerFromBox({ boxId, box_code: boxCode }) : null;
    let delivery = await Delivery.findOne({ orderReference });
    if (!delivery) {
      delivery = new Delivery({ orderReference });
    }
    delivery.customerMobile = whatsappPhone || delivery.customerMobile;
    delivery.customerName = customerName || delivery.customerName || whatsappPhone || '';
    delivery.status = delivery.status === 'completed' ? delivery.status : 'pending';
    delivery.otpStatus = delivery.otpStatus === 'verified' ? delivery.otpStatus : 'pending';
    if (locker) {
      delivery.lockerBoxId = locker.boxId;
      delivery.lockerCode = locker.boxCode;
      delivery.city = locker.city;
    }
    pushTimeline(delivery, 'registered', 'Expected delivery registered');
    await delivery.save();
    return delivery;
  }

  async recordResolve(orderReference, data = {}) {
    const locker = await this.upsertLockerFromBox({
      boxId: data.boxId,
      box_code: data.boxCode,
      address: data.address,
      google_maps_link: data.googleMaps,
      box_status: 'in_use',
    });

    let delivery = await Delivery.findOne({ orderReference });
    if (!delivery) {
      delivery = new Delivery({ orderReference });
    }
    delivery.status = delivery.status === 'completed' ? delivery.status : 'matched';
    delivery.otpStatus = 'sent';
    delivery.sessionId = data.deliverySessionId ? String(data.deliverySessionId) : delivery.sessionId;
    delivery.lastOtp = '';
    if (data.otpExpiresAt) delivery.otpExpiresAt = new Date(data.otpExpiresAt);
    if (data.address) delivery.lastAddress = String(data.address);
    if (data.googleMaps) delivery.lastGoogleMaps = String(data.googleMaps);
    delivery.customerName = data.recipientName || delivery.customerName;
    delivery.city = cityFromAddress(data.address) || delivery.city;
    if (locker) {
      delivery.lockerBoxId = locker.boxId;
      delivery.lockerCode = locker.boxCode;
    } else if (data.boxCode) {
      delivery.lockerCode = data.boxCode;
    }
    pushTimeline(delivery, 'matched', data.address || 'Locker matched');
    pushTimeline(delivery, 'otp_generated', data.otp ? 'OTP issued' : 'OTP requested');
    await delivery.save();
    return delivery;
  }

  async recordConfirm(payload = {}, result = {}) {
    const query = payload.deliverySessionId
      ? { sessionId: String(payload.deliverySessionId) }
      : payload.orderReference
        ? { orderReference: payload.orderReference }
        : null;
    if (!query) return null;

    const delivery = await Delivery.findOne(query);
    if (!delivery) return null;

    if (payload.boxId) {
      const locker = await this.upsertLockerFromBox({
        boxId: payload.boxId,
        box_status: 'available',
      });
      if (locker) {
        locker.status = 'available';
        locker.occupancy = 0;
        await locker.save();
        delivery.lockerBoxId = locker.boxId;
        delivery.lockerCode = locker.boxCode;
      }
    }

    delivery.driverPhone = payload.driverPhone || delivery.driverPhone;
    delivery.driverName = payload.driverPhone || delivery.driverName;
    delivery.vendor = payload.vendorName || delivery.vendor;
    delivery.status = 'completed';
    delivery.otpStatus = 'verified';
    pushTimeline(delivery, 'locker_opened', 'Locker opened');
    pushTimeline(delivery, 'completed', result.message || 'Delivery confirmed');
    await delivery.save();
    return delivery;
  }

  async recordFindCustomer(payload = {}, data = {}) {
    const boxes = data.boxes || [];
    for (const box of boxes) {
      await this.upsertLockerFromBox(box);
    }
    if (data.locker && !boxes.length) {
      await this.upsertLockerFromBox({ box_code: data.locker, boxId: boxes[0]?.boxId });
    }
    return boxes;
  }

  async touchWhatsAppContact({ phone, name, lastOrderReference, lastIntent } = {}) {
    const { digitsOnly, normalizePhone } = require('../utils/phone');
    const phoneDigits = digitsOnly(phone);
    if (!phoneDigits) return null;

    const updates = {
      phone: normalizePhone(phone),
      phoneDigits,
      lastMessageAt: new Date(),
    };
    if (name) updates.name = String(name).trim();
    if (lastOrderReference) updates.lastOrderReference = String(lastOrderReference).trim();
    if (lastIntent) updates.lastIntent = String(lastIntent).trim();

    return WhatsAppContact.findOneAndUpdate(
      { phoneDigits },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async listDeliveries() {
    const items = await Delivery.find({}).sort({ createdAt: -1 }).limit(500);
    const lockers = await Locker.find({});
    const byBox = new Map(lockers.map((l) => [l.boxId, l]));
    return items.map((item) => {
      const dto = toDeliveryDto(item);
      const locker = item.lockerBoxId != null ? byBox.get(item.lockerBoxId) : null;
      if (locker) dto.lockerId = String(locker._id);
      return dto;
    });
  }

  async getDelivery(id) {
    const delivery = await this.findDelivery(id);
    if (!delivery) {
      const error = new Error('Delivery not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    const dto = toDeliveryDto(delivery);
    if (delivery.lockerBoxId != null) {
      const locker = await Locker.findOne({ boxId: delivery.lockerBoxId });
      if (locker) dto.lockerId = String(locker._id);
    }
    return dto;
  }

  async findDelivery(id) {
    if (/^[a-f0-9]{24}$/i.test(id)) {
      const byId = await Delivery.findById(id);
      if (byId) return byId;
    }
    return Delivery.findOne({ orderReference: decodeURIComponent(id) });
  }

  async listLockers() {
    const items = await Locker.find({}).sort({ boxId: 1 });
    return items.map(toLockerDto);
  }

  async getLocker(id) {
    let locker = null;
    if (/^[a-f0-9]{24}$/i.test(id)) locker = await Locker.findById(id);
    if (!locker && /^\d+$/.test(id)) locker = await Locker.findOne({ boxId: Number(id) });
    if (!locker) locker = await Locker.findOne({ boxCode: decodeURIComponent(id) });
    if (!locker) {
      const error = new Error('Locker not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    const deliveries = await Delivery.find({ lockerBoxId: locker.boxId }).sort({ createdAt: -1 }).limit(50);
    const lockers = await Locker.find({});
    const byBox = new Map(lockers.map((l) => [l.boxId, l]));
    return {
      locker: toLockerDto(locker),
      deliveries: deliveries.map((item) => {
        const dto = toDeliveryDto(item);
        const linked = item.lockerBoxId != null ? byBox.get(item.lockerBoxId) : null;
        if (linked) dto.lockerId = String(linked._id);
        return dto;
      }),
    };
  }

  series(days, counts) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().slice(0, 10);
      return { date: key, value: counts.get(key) || 0 };
    });
  }

  async dashboard() {
    const [deliveries, lockers, conversations, callLogs, contacts] = await Promise.all([
      Delivery.find({}),
      Locker.find({}),
      Conversation.find({}),
      CallLog.find({}),
      WhatsAppContact.find({}),
    ]);

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const totalDeliveries = deliveries.length;
    const pendingDeliveries = deliveries.filter((d) => d.status === 'pending' || d.status === 'matched').length;
    const completedDeliveries = deliveries.filter((d) => d.status === 'completed').length;
    const failedDeliveries = deliveries.filter((d) => d.status === 'expired' || d.status === 'cancelled').length;
    const activeLockers = lockers.filter((l) => l.status !== 'deactivated').length;
    const activeCustomers = new Set(
      deliveries.map((d) => d.customerMobile).filter(Boolean).concat(contacts.map((c) => c.phoneDigits || c.phone))
    ).size;
    const activeDrivers = new Set(deliveries.map((d) => d.driverPhone || d.driverName).filter(Boolean)).size;
    const voiceCallsToday = callLogs.filter((c) => new Date(c.startedAt || c.createdAt) >= startToday).length;
    const whatsappMessagesToday = contacts.filter(
      (c) => c.lastMessageAt && new Date(c.lastMessageAt) >= startToday
    ).length;
    const resolvedConvos = conversations.filter((c) => c.status === 'completed').length;
    const aiResolutionRate = conversations.length
      ? Math.round((resolvedConvos / conversations.length) * 1000) / 10
      : 0;

    const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
    const deliveryCounts = new Map();
    const completedCounts = new Map();
    const customerCounts = new Map();
    const convoCounts = new Map();
    const convoResolved = new Map();

    deliveries.forEach((d) => {
      const key = dayKey(d.createdAt);
      deliveryCounts.set(key, (deliveryCounts.get(key) || 0) + 1);
      if (d.status === 'completed') completedCounts.set(key, (completedCounts.get(key) || 0) + 1);
      if (d.customerMobile) customerCounts.set(key, (customerCounts.get(key) || 0) + 1);
    });
    conversations.forEach((c) => {
      const key = dayKey(c.timestamp || c.createdAt);
      convoCounts.set(key, (convoCounts.get(key) || 0) + 1);
      if (c.status === 'completed') convoResolved.set(key, (convoResolved.get(key) || 0) + 1);
    });

    const days = 14;
    const deliveriesSeries = this.series(days, deliveryCounts);
    const completedSeries = this.series(days, completedCounts);
    const successRate = deliveriesSeries.map((point, i) => {
      const total = point.value;
      const done = completedSeries[i].value;
      return { date: point.date, value: total ? Math.round((done / total) * 100) : 0 };
    });
    const utilization = this.series(days, deliveryCounts).map((point) => ({
      date: point.date,
      value: lockers.length ? Math.min(100, Math.round((point.value / Math.max(lockers.length, 1)) * 100)) : 0,
    }));
    const aiSeries = this.series(days, convoCounts).map((point, i) => {
      const total = point.value;
      const done = this.series(days, convoResolved)[i].value;
      return { date: point.date, value: total ? Math.round((done / total) * 100) : 0 };
    });

    const activity = [
      ...deliveries
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((d) => ({
          id: String(d._id),
          type: 'delivery',
          title: `Delivery ${d.orderReference}`,
          description: `${d.status} — ${d.customerName || d.customerMobile || 'Customer'}`,
          timestamp: d.updatedAt.toISOString(),
        })),
      ...lockers.slice(0, 4).map((l) => ({
        id: String(l._id),
        type: 'locker',
        title: `Locker ${l.boxCode}`,
        description: `${l.status} at ${l.location || l.city}`,
        timestamp: l.updatedAt.toISOString(),
      })),
      ...conversations
        .filter((c) => c.status === 'failed')
        .slice(0, 3)
        .map((c) => ({
          id: String(c._id),
          type: 'ai_escalation',
          title: 'AI Escalation',
          description: `${c.intent || 'Conversation'} from ${c.callerNumber}`,
          timestamp: new Date(c.timestamp || c.createdAt).toISOString(),
        })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 12);

    return {
      kpis: {
        totalDeliveries,
        pendingDeliveries,
        completedDeliveries,
        failedDeliveries,
        activeLockers,
        activeCustomers,
        activeDrivers,
        voiceCallsToday,
        whatsappMessagesToday,
        aiResolutionRate,
      },
      charts: {
        deliveries: deliveriesSeries,
        utilization,
        successRate,
        customers: this.series(days, customerCounts),
        aiResolution: aiSeries,
        revenue: completedSeries,
      },
      activity,
    };
  }
}

module.exports = new OpsService();
