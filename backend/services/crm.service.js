const Delivery = require('../models/Delivery');
const Locker = require('../models/Locker');
const Conversation = require('../models/Conversation');
const CallLog = require('../models/CallLog');
const WhatsAppContact = require('../models/WhatsAppContact');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { digitsOnly, normalizePhone } = require('../utils/phone');
const { HTTP_STATUS } = require('../utils/constants');
const opsService = require('./ops.service');

const isRider = (name = '', intent = '') => {
  const text = `${name} ${intent}`.toLowerCase();
  return text.includes('rider') || text.includes('driver') || text.includes('resolve');
};

const series = (days, counts) => {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, value: counts.get(key) || 0 };
  });
};

const mapCallOutcome = (status) => {
  const value = String(status || '');
  if (value === 'completed') return 'resolved';
  if (value === 'failed') return 'failed';
  if (['no_answer', 'busy', 'cancelled'].includes(value)) return 'missed';
  return 'escalated';
};

class CrmService {
  async logAudit({ userId, userName, action, resource, ipAddress, beforeValue, afterValue }) {
    await AuditLog.create({
      userId: userId ? String(userId) : '',
      userName: userName || 'system',
      action,
      resource,
      ipAddress: ipAddress || '',
      beforeValue: beforeValue || '',
      afterValue: afterValue || '',
    });
  }

  async listAuditLogs() {
    const items = await AuditLog.find({}).sort({ createdAt: -1 }).limit(200);
    return items.map((item) => ({
      id: String(item._id),
      userId: item.userId,
      userName: item.userName,
      action: item.action,
      resource: item.resource,
      timestamp: item.createdAt.toISOString(),
      ipAddress: item.ipAddress || '—',
      beforeValue: item.beforeValue || undefined,
      afterValue: item.afterValue || undefined,
    }));
  }

  async roleCounts() {
    const users = await User.find({});
    const counts = {
      super_admin: 0,
      operations_admin: 0,
      customer_support: 0,
      ai_supervisor: 0,
      customer: 0,
    };
    users.forEach((user) => {
      if (user.role === 'admin') counts.super_admin += 1;
      else if (user.role === 'operator') counts.operations_admin += 1;
      else counts.customer_support += 1;
    });
    return counts;
  }

  async buildDirectory() {
    const [contacts, deliveries, lockers] = await Promise.all([
      WhatsAppContact.find({}),
      Delivery.find({}),
      Locker.find({}),
    ]);

    const lockerByBox = new Map(lockers.map((l) => [l.boxId, l]));
    const lockerByCode = new Map(lockers.map((l) => [l.boxCode, l]));
    const customers = new Map();
    const drivers = new Map();

    const upsertCustomer = (phone, patch = {}) => {
      const digits = digitsOnly(phone);
      if (!digits) return;
      const id = `cus-${digits}`;
      const current = customers.get(id) || {
        id,
        name: '',
        mobile: normalizePhone(phone),
        email: `${digits}@llbox.customer`,
        nationalId: '—',
        assignedLockerId: undefined,
        assignedLockerCode: undefined,
        totalDeliveries: 0,
        lastDeliveryDate: undefined,
        status: 'active',
        city: 'Riyadh',
      };
      customers.set(id, { ...current, ...patch, mobile: patch.mobile || current.mobile });
    };

    const upsertDriver = (phone, patch = {}) => {
      const digits = digitsOnly(phone);
      if (!digits) return;
      const id = `drv-${digits}`;
      const current = drivers.get(id) || {
        id,
        name: '',
        mobile: normalizePhone(phone),
        company: 'LLBox Fleet',
        completedDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        status: 'active',
        city: 'Riyadh',
      };
      drivers.set(id, { ...current, ...patch, mobile: patch.mobile || current.mobile });
    };

    contacts.forEach((contact) => {
      const patch = {
        name: contact.name || contact.phone,
        mobile: contact.phone,
      };
      if (isRider(contact.name, contact.lastIntent)) {
        upsertDriver(contact.phone, patch);
      } else {
        upsertCustomer(contact.phone, patch);
      }
    });

    deliveries.forEach((delivery) => {
      if (delivery.customerMobile) {
        const locker = delivery.lockerBoxId != null ? lockerByBox.get(delivery.lockerBoxId) : lockerByCode.get(delivery.lockerCode);
        upsertCustomer(delivery.customerMobile, {
          name: delivery.customerName || delivery.customerMobile,
          mobile: delivery.customerMobile,
          assignedLockerId: locker ? String(locker._id) : undefined,
          assignedLockerCode: delivery.lockerCode || locker?.boxCode,
          city: delivery.city || locker?.city || 'Riyadh',
        });
        const customer = customers.get(`cus-${digitsOnly(delivery.customerMobile)}`);
        if (customer) {
          customer.totalDeliveries += 1;
          const stamp = delivery.updatedAt || delivery.createdAt;
          if (!customer.lastDeliveryDate || stamp > new Date(customer.lastDeliveryDate)) {
            customer.lastDeliveryDate = stamp.toISOString();
          }
        }
      }

      const driverPhone = delivery.driverPhone || delivery.driverName;
      if (driverPhone && digitsOnly(driverPhone)) {
        upsertDriver(driverPhone, {
          name: delivery.driverName || driverPhone,
          mobile: delivery.driverPhone || driverPhone,
          city: delivery.city || 'Riyadh',
        });
        const driver = drivers.get(`drv-${digitsOnly(driverPhone)}`);
        if (driver) {
          if (delivery.status === 'completed') driver.completedDeliveries += 1;
          if (delivery.status === 'expired' || delivery.status === 'cancelled') driver.failedDeliveries += 1;
        }
      }
    });

    drivers.forEach((driver) => {
      const total = driver.completedDeliveries + driver.failedDeliveries;
      driver.successRate = total ? Math.round((driver.completedDeliveries / total) * 1000) / 10 : 0;
    });

    return { customers: [...customers.values()], drivers: [...drivers.values()] };
  }

  async listCustomers() {
    const { customers } = await this.buildDirectory();
    return customers.sort((a, b) => (b.lastDeliveryDate || '').localeCompare(a.lastDeliveryDate || ''));
  }

  async getCustomer(id) {
    const customers = await this.listCustomers();
    const customer = customers.find((item) => item.id === id);
    if (!customer) {
      const error = new Error('Customer not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    const digits = digitsOnly(customer.mobile);
    const deliveries = (await opsService.listDeliveries()).filter(
      (item) => digitsOnly(item.customerMobile) === digits || item.customerId === customer.id
    );
    const convos = await Conversation.find({
      callerNumber: new RegExp(digits.slice(-9)),
    })
      .sort({ timestamp: -1 })
      .limit(8)
      .lean();
    const conversations = convos.map((item) => ({
      id: String(item._id),
      channel: String(item.metadata?.channel || item.intent || '').toLowerCase().includes('whatsapp')
        ? 'whatsapp'
        : 'voice',
      status: item.status === 'completed' ? 'resolved' : item.status === 'failed' ? 'escalated' : 'active',
      subject: item.intent || 'Conversation',
      updatedAt: new Date(item.timestamp || item.createdAt).toISOString(),
    }));
    return { customer, deliveries, conversations };
  }

  async listDrivers() {
    const { drivers } = await this.buildDirectory();
    return drivers.sort((a, b) => b.completedDeliveries - a.completedDeliveries);
  }

  async getDriver(id) {
    const drivers = await this.listDrivers();
    const driver = drivers.find((item) => item.id === id);
    if (!driver) {
      const error = new Error('Driver not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    const digits = digitsOnly(driver.mobile);
    const deliveries = (await opsService.listDeliveries()).filter(
      (item) => digitsOnly(item.driverId || '') === digits || digitsOnly(item.driverName || '') === digits
    );
    const counts = new Map();
    deliveries.forEach((item) => {
      const key = String(item.createdAt).slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return { driver, deliveries, chart: series(14, counts) };
  }

  async listVoiceCalls() {
    const [logs, convos] = await Promise.all([
      CallLog.find({}).sort({ startedAt: -1 }).limit(200).lean(),
      Conversation.find({}).sort({ timestamp: -1 }).limit(200).lean(),
    ]);

    const fromLogs = logs.map((item) => ({
      id: String(item._id),
      driverNumber: item.incomingNumber || '',
      customerNumber: String(item.metadata?.customerNumber || ''),
      duration: Number(item.duration || 0),
      outcome: mapCallOutcome(item.status),
      recordingUrl: item.recordingUrl || undefined,
      transcript: item.notes || undefined,
      createdAt: new Date(item.startedAt || item.createdAt).toISOString(),
    }));

    const fromConvos = convos.map((item) => ({
      id: String(item._id),
      driverNumber: item.callerNumber || '',
      customerNumber: '',
      duration: Number(item.duration || 0),
      outcome: mapCallOutcome(item.status === 'completed' ? 'completed' : item.status === 'failed' ? 'failed' : 'in_progress'),
      transcript: item.transcript || item.response || undefined,
      createdAt: new Date(item.timestamp || item.createdAt).toISOString(),
    }));

    const merged = [...fromLogs, ...fromConvos];
    const seen = new Set();
    return merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  async getVoiceCall(id) {
    const calls = await this.listVoiceCalls();
    const call = calls.find((item) => item.id === id);
    if (!call) {
      const error = new Error('Call not found');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return call;
  }

  async analytics() {
    const [deliveries, lockers, conversations, contacts] = await Promise.all([
      Delivery.find({}),
      Locker.find({}),
      Conversation.find({}),
      WhatsAppContact.find({}),
    ]);

    const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
    const deliveryCounts = new Map();
    const completedCounts = new Map();
    const hourCounts = new Map();
    const voiceResolved = new Map();
    const voiceTotal = new Map();
    const waResolved = new Map();
    const waTotal = new Map();
    const customerDay = new Map();

    deliveries.forEach((item) => {
      const key = dayKey(item.createdAt);
      deliveryCounts.set(key, (deliveryCounts.get(key) || 0) + 1);
      if (item.status === 'completed') completedCounts.set(key, (completedCounts.get(key) || 0) + 1);
      const hour = new Date(item.createdAt).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      if (item.customerMobile) customerDay.set(key, (customerDay.get(key) || 0) + 1);
    });

    conversations.forEach((item) => {
      const key = dayKey(item.timestamp || item.createdAt);
      const whatsapp = String(item.intent || item.metadata?.channel || '').toLowerCase().includes('whatsapp');
      const resolved = item.status === 'completed';
      if (whatsapp) {
        waTotal.set(key, (waTotal.get(key) || 0) + 1);
        if (resolved) waResolved.set(key, (waResolved.get(key) || 0) + 1);
      } else {
        voiceTotal.set(key, (voiceTotal.get(key) || 0) + 1);
        if (resolved) voiceResolved.set(key, (voiceResolved.get(key) || 0) + 1);
      }
      const hour = new Date(item.timestamp || item.createdAt).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    contacts.forEach((item) => {
      if (!item.lastMessageAt) return;
      const key = dayKey(item.lastMessageAt);
      waTotal.set(key, (waTotal.get(key) || 0) + 1);
    });

    const rate = (totalMap, doneMap, days) =>
      series(days, totalMap).map((point, i) => {
        const total = point.value;
        const done = series(days, doneMap)[i].value;
        return { date: point.date, value: total ? Math.round((done / total) * 100) : 0 };
      });

    const deliveriesSeries = series(30, deliveryCounts);
    const completedSeries = series(30, completedCounts);
    const successRate = deliveriesSeries.map((point, i) => ({
      date: point.date,
      value: point.value ? Math.round((completedSeries[i].value / point.value) * 100) : 0,
    }));
    const utilization = deliveriesSeries.map((point) => ({
      date: point.date,
      value: lockers.length ? Math.min(100, Math.round((point.value / Math.max(lockers.length, 1)) * 100)) : 0,
    }));
    const peakHours = Array.from({ length: 24 }, (_, hour) => ({
      date: `1970-01-01T${String(hour).padStart(2, '0')}:00:00.000Z`,
      value: hourCounts.get(hour) || 0,
    }));

    const uniqueCustomers = new Set(deliveries.map((d) => d.customerMobile).filter(Boolean)).size || 1;
    const perCustomer = deliveriesSeries.map((point) => ({
      date: point.date,
      value: Math.round((point.value / uniqueCustomers) * 10) / 10,
    }));

    const voiceConvos = conversations.filter((c) => !String(c.intent || '').toLowerCase().includes('whatsapp'));
    const waConvos = conversations.filter((c) => String(c.intent || '').toLowerCase().includes('whatsapp'));
    const voiceRes = voiceConvos.length
      ? Math.round((voiceConvos.filter((c) => c.status === 'completed').length / voiceConvos.length) * 1000) / 10
      : 0;
    const waRes = waConvos.length
      ? Math.round((waConvos.filter((c) => c.status === 'completed').length / waConvos.length) * 1000) / 10
      : contacts.length
        ? 100
        : 0;
    const escalation = conversations.length
      ? Math.round((conversations.filter((c) => c.status === 'failed').length / conversations.length) * 1000) / 10
      : 0;
    const cost = conversations.length ? (conversations.length * 0.12).toFixed(2) : '0.00';

    return {
      stats: {
        voiceResolution: `${voiceRes}%`,
        whatsappResolution: `${waRes}%`,
        escalationRate: `${escalation}%`,
        costPerConversation: `${cost} SAR`,
      },
      charts: {
        deliveries: deliveriesSeries,
        successRate,
        utilization,
        peakHours,
        voiceResolution: rate(voiceTotal, voiceResolved, 30),
        whatsappResolution: rate(waTotal, waResolved, 30),
        revenue: series(12, completedCounts),
        deliveriesPerCustomer: perCustomer,
      },
    };
  }
}

module.exports = new CrmService();
