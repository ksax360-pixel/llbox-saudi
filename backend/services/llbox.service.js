const axios = require('axios');
const logger = require('../config/logger');

/**
 * LLBox API client (business logic gateway).
 * Phase 1: returns dummy responses when LLBOX_DUMMY_MODE=true (default).
 * Phase 2: set LLBOX_DUMMY_MODE=false and provide LLBOX_API_KEY to hit production LLBox.
 *
 * Reference: LLBox X360 Integration Guide
 * Base URL: https://llbox.up.railway.app/api/v1
 * Auth header: X-Agent-API-Key
 */
class LlboxService {
  constructor() {
    this.baseUrl = process.env.LLBOX_BASE_URL || 'https://llbox.up.railway.app/api/v1';
    this.apiKey = process.env.LLBOX_API_KEY;
    this.dummyMode = String(process.env.LLBOX_DUMMY_MODE || 'true').toLowerCase() !== 'false';
  }

  /**
   * @param {object} opts
   * @param {boolean} opts.noRetry  writes that must not be repeated (cancel, code, ticket, driver-contact)
   */
  async request(method, path, { body, retried = false, rateRetries = 0, noRetry = false } = {}) {
    if (this.dummyMode) {
      throw new Error('request() should not be called in dummy mode');
    }

    if (!this.apiKey) {
      throw new Error('LLBOX_API_KEY is not set');
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'X-Agent-API-Key': this.apiKey,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        data: body,
        validateStatus: () => true,
      });

      if (response.status === 500 && !retried && !noRetry) {
        logger.warn(`LLBox 500 on ${method} ${path} – retrying once`);
        return this.request(method, path, { body, retried: true, rateRetries });
      }

      if (response.status === 429 && rateRetries < 2 && !noRetry) {
        logger.warn(`LLBox 429 on ${method} ${path} – retry ${rateRetries + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 600 * (rateRetries + 1)));
        return this.request(method, path, { body, retried, rateRetries: rateRetries + 1 });
      }

      return { status: response.status, data: response.data };
    } catch (error) {
      logger.error(`LLBox request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Journey 1 – resolve order reference → box + OTP
   * Real: GET /agent/box/by-reference/:orderReference
   * Addendum 2.2: do NOT branch on box_status; handle ambiguous / at_capacity.
   */
  async resolveDelivery(orderReference) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] resolveDelivery: ${orderReference}`);
      return {
        success: true,
        otp: '4589',
        address: '7154 Al Jaouar, Al Faruq, Riyadh 12861',
        addressArabic: null,
        googleMaps: 'https://maps.google.com/?q=24.651022,46.764264',
        deliverySessionId: '12345',
        boxId: 7,
        boxCode: 'A12',
        boxStatus: 'available',
        boxPhotoUrl: null,
        boxPhotos: [
          {
            url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            category: 'street',
            caption: 'Second gate on the left',
          },
        ],
        otpExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        recipientName: 'QA ProdTest',
        orderReference,
        latitude: 24.651022,
        longitude: 46.764264,
        mode: 'dummy',
      };
    }

    const { status, data } = await this.request(
      'GET',
      `/agent/box/by-reference/${encodeURIComponent(orderReference)}`
    );

    if (status === 200) {
      let boxPhotos = Array.isArray(data.box_photos)
        ? data.box_photos
        : data.box_photo_url
          ? [{ url: data.box_photo_url, category: 'box', caption: null }]
          : [];

      // Optional: inject demo Cloudinary images when gallery empty (QA boxes often have none).
      // Never invent photos for real production boxes — only QA-PROD-TEST-BOX / explicit env.
      const isQaBox =
        String(data.box_code || '').toUpperCase() === 'QA-PROD-TEST-BOX' ||
        Number(data.box_id) === 3;
      if (
        !boxPhotos.length &&
        (process.env.LLBOX_FORCE_DEMO_PHOTOS === 'true' ||
          (isQaBox && process.env.LLBOX_FORCE_DEMO_PHOTOS !== 'false'))
      ) {
        boxPhotos = [
          {
            url: 'https://res.cloudinary.com/demo/image/upload/w_1000,c_fill,q_auto,f_auto/sample.jpg',
            category: 'street',
            caption: null,
          },
          {
            url: 'https://res.cloudinary.com/demo/image/upload/w_1000,c_fill,q_auto,f_auto/docs/models.jpg',
            category: 'box',
            caption: null,
          },
        ];
        logger.info(`[PHOTOS] Injected demo Cloudinary gallery for QA ${orderReference}`);
      }

      return {
        success: true,
        otp: data.otp,
        address: data.address,
        addressArabic: data.address_arabic || null,
        googleMaps: data.google_maps_link,
        deliverySessionId: String(data.delivery_session_id),
        boxId: data.box_id,
        boxCode: data.box_code,
        boxStatus: data.box_status,
        boxPhotoUrl: data.box_photo_url || boxPhotos[0]?.url || null,
        boxPhotos,
        otpExpiresAt: data.otp_expires_at,
        recipientName: data.recipient_name,
        paymentType: data.payment_type || 'unknown',
        codAmount: data.cod_amount ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        instructions: data.instructions || null,
        orderReference: data.order_reference || data.reference || orderReference,
      };
    }

    // A code is shown once (Conversation Reference p9/p17 #3). A 404 already_matched is final —
    // never replay a previously issued code.
    // Do NOT auto-reset on box_status in_use — boxes now serve multiple deliveries (addendum 2.2).
    const msg =
      (typeof data === 'string' && data) ||
      data?.message ||
      (status === 429 ? 'LLBox rate limit — please retry in a few minutes' : 'Failed to resolve delivery');
    const error = new Error(msg);
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  _extractBoxIdFromPayload(data) {
    if (!data || typeof data !== 'object') return null;
    const candidates = [
      data.box_id,
      data.boxId,
      data.locker_box_id,
      data.lockerBoxId,
      data?.box?.id,
      data?.box?.box_id,
      data?.details?.box_id,
      data?.details?.boxId,
      data?.error?.box_id,
    ];
    for (const raw of candidates) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const blob = JSON.stringify(data);
    const m = blob.match(/"box_id"\s*:\s*(\d+)/i) || blob.match(/"boxId"\s*:\s*(\d+)/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  /**
   * Attempt to free a locker stuck in in_use / expired session on LLBox.
   * Working path: POST /agent/box/:boxId/reset then immediately re-resolve.
   * Confirm/expire on old sessions does NOT free the current lock.
   */
  async clearStuckLockerSession({ orderReference, boxId, deliverySessionId } = {}) {
    if (this.dummyMode) {
      return { success: true, message: 'Dummy clear', mode: 'dummy' };
    }

    let resolvedBoxId = boxId ? Number(boxId) : null;
    const attempts = [];

    if (orderReference) {
      try {
        const Delivery = require('../models/Delivery');
        const delivery = await Delivery.findOne({ orderReference }).lean();
        if (delivery?.lockerBoxId) resolvedBoxId = Number(delivery.lockerBoxId);
      } catch (error) {
        logger.warn(`Delivery lookup for clear failed: ${error.message}`);
      }
    }

    // QA live test order is permanently mapped to box 3 (409 payloads omit box_id).
    if (!resolvedBoxId && orderReference && /X360-LIVE-20260816-195929-B3/i.test(orderReference)) {
      resolvedBoxId = 3;
    }

    if (!resolvedBoxId) {
      return {
        success: false,
        message: 'Cannot clear locker session without boxId/orderReference',
        attempts,
      };
    }

    // Primary fix: LLBox agent box reset. Must be followed immediately by resolve
    // (GET /agent/box/:id can show in_use again; by-reference still succeeds right after reset).
    const resetPath = `/agent/box/${resolvedBoxId}/reset`;
    const reset = await this.request('POST', resetPath, { body: {} });
    attempts.push({ path: resetPath, status: reset.status, data: reset.data });

    if (reset.status === 429) {
      return {
        success: false,
        rateLimited: true,
        message: 'LLBox rate limit — please retry in a few minutes',
        boxId: resolvedBoxId,
        attempts,
      };
    }

    if (reset.status >= 200 && reset.status < 300) {
      return {
        success: true,
        message: `Locker reset via ${resetPath}`,
        boxId: resolvedBoxId,
        boxCode: reset.data?.box_code,
        attempts,
        retried: true,
        deliverySessionId: deliverySessionId || undefined,
      };
    }

    return {
      success: false,
      message:
        'Locker still has an active/expired session on LLBox. WhatsApp clear only resets chat memory — the physical locker session must be closed in LLBox dashboard (QA-PROD-TEST-BOX).',
      boxId: resolvedBoxId,
      attempts,
    };
  }

  /**
   * Box is free for a new delivery session when status is available.
   * Note: GET /agent/box/:id can return HTTP 200 with box_status "in_use".
   */
  async isBoxFree(boxId) {
    if (!boxId) return false;
    const { status, data } = await this.request('GET', `/agent/box/${boxId}`);
    if (status === 409 && /in_use|active delivery/i.test(String(data?.message || data?.reason || ''))) {
      return false;
    }
    if (status === 200) {
      const boxStatus = String(data?.box_status || '').toLowerCase();
      return boxStatus === 'available' || boxStatus === 'free' || boxStatus === '';
    }
    return false;
  }

  /**
   * Journey 1 fallback – manual confirm
   * Real: POST /agent/delivery/confirm
   */
  async confirmDelivery(payload) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] confirmDelivery: ${JSON.stringify(payload)}`);
      return {
        success: true,
        message: 'Delivery Confirmed',
        deliverySessionId: payload.deliverySessionId,
        mode: 'dummy',
      };
    }

    const body = {
      delivery_session_id: payload.deliverySessionId,
      box_id: payload.boxId,
      driver_phone: payload.driverPhone,
      otp_provided: payload.otpProvided,
      parcel_count: payload.parcelCount,
      vendor_name: payload.vendorName,
      notes: payload.notes,
      confirmed_by: 'agent',
    };

    const { status, data } = await this.request('POST', '/agent/delivery/confirm', { body });

    if (status === 200 || (status === 409 && data?.code === 'ALREADY_CONFIRMED')) {
      return {
        success: true,
        message: status === 409 ? 'Delivery already confirmed' : 'Delivery Confirmed',
        alreadyConfirmed: status === 409,
      };
    }

    const error = new Error(data?.message || 'Failed to confirm delivery');
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  /**
   * Journey 2 – register expected delivery
   * Real: POST /agent/expected-deliveries
   * Addendum: optional expected_delivery_date (YYYY-MM-DD)
   */
  async registerDelivery(payload) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] registerDelivery: ${JSON.stringify(payload)}`);
      return {
        success: true,
        message: 'Delivery Registered',
        expectedDeliveryId: 'ed_dummy_001',
        boxCode: 'A12',
        orderReference: payload.orderReference,
        expectedDeliveryDate: payload.expectedDeliveryDate || null,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        mode: 'dummy',
      };
    }

    const body = {
      whatsapp_phone: payload.whatsappPhone,
      order_reference: payload.orderReference,
      ...(payload.boxId ? { box_id: payload.boxId } : {}),
      ...(payload.expectedDeliveryDate
        ? { expected_delivery_date: payload.expectedDeliveryDate }
        : {}),
      ...(payload.paymentType ? { payment_type: payload.paymentType } : {}),
      ...(payload.codAmount != null ? { cod_amount: payload.codAmount } : {}),
    };

    const { status, data } = await this.request('POST', '/agent/expected-deliveries', { body });

    if (status === 201 || status === 200) {
      return {
        success: true,
        message: 'Delivery Registered',
        expectedDeliveryId: data.expected_delivery_id,
        boxCode: data.box_code,
        expectedDeliveryDate: data.expected_delivery_date || payload.expectedDeliveryDate || null,
        expiresAt: data.expires_at || null,
        warning: data.warning || null,
        deliveriesThatDay: data.deliveries_that_day || null,
        paymentType: data.payment_type || payload.paymentType || null,
        codAmount: data.cod_amount ?? payload.codAmount ?? null,
        orderReference: payload.orderReference,
      };
    }

    const error = new Error(data?.message || 'Failed to register delivery');
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  /**
   * Identify WhatsApp sender (customer vs unknown/driver).
   * Real: POST /agent/whatsapp/identify
   */
  async identifyWhatsapp(whatsappPhone) {
    if (this.dummyMode) {
      return {
        userFound: false,
        message: 'No LLBox account is registered to this number',
        mode: 'dummy',
      };
    }

    const { status, data } = await this.request('POST', '/agent/whatsapp/identify', {
      body: { whatsapp_phone: whatsappPhone },
    });

    if (status === 404 || data?.user_found === false) {
      return {
        userFound: false,
        message: data?.message || 'No LLBox account is registered to this number',
      };
    }

    if (status === 200) {
      return {
        userFound: true,
        recipientName: data.recipient_name,
        boxes: (data.boxes || []).map((b) => ({
          boxId: b.box_id,
          boxCode: b.box_code,
          nickname: b.nickname,
          status: b.status,
          yourRole: b.your_role,
          phoneNumber: b.phone_number || null,
          health: b.health || 'unknown',
        })),
        preferences: {
          whatsappOptOut: Boolean(data.preferences?.whatsapp_opt_out),
          allowDriverContact: data.preferences?.allow_driver_contact !== false,
        },
        availableActions: data.available_actions || [],
        activeDeliveries: data.active_deliveries || 0,
        parcelAwaitingCollection: Boolean(data.parcel_awaiting_collection),
        summary: data.summary || '',
      };
    }

    const error = new Error(data?.message || 'Failed to identify WhatsApp user');
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  /**
   * Notify recipient via LLBox app when driver is stuck.
   * Real: POST /agent/whatsapp/notify-recipient
   */
  async notifyRecipient({ orderReference, issue, note } = {}) {
    if (this.dummyMode) {
      return { success: true, notified: true, mode: 'dummy' };
    }

    const { status, data } = await this.request('POST', '/agent/whatsapp/notify-recipient', {
      body: {
        order_reference: orderReference,
        issue,
        ...(note ? { note } : {}),
      },
    });

    logger.info(`[notify] ${orderReference} issue=${issue} status=${status} notified=${data?.notified}`);

    if (status >= 200 && status < 300) {
      return {
        success: true,
        notified: data?.notified !== false,
        message: data?.message,
      };
    }

    const error = new Error(data?.message || 'Failed to notify recipient');
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  /**
   * OTP validation — LLBox always returns HTTP 200; answer is in data.valid.
   * Real: POST /agent/otp/validate
   */
  async validateOtp(payload = {}) {
    if (this.dummyMode) {
      const provided = String(payload.otp || payload.otpProvided || '').trim();
      const expected = String(payload.expectedOtp || '4589').trim();
      const valid = provided === expected;
      return {
        valid,
        reason: valid ? null : 'mismatch',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        mode: 'dummy',
      };
    }

    const body = {
      otp: payload.otp || payload.otpProvided,
      delivery_session_id: payload.deliverySessionId || payload.delivery_session_id,
      box_id: payload.boxId || payload.box_id,
      order_reference: payload.orderReference || payload.order_reference,
    };

    const { data } = await this.request('POST', '/agent/otp/validate', { body });
    return data?.data || data || { valid: false, reason: 'unknown' };
  }

  /**
   * Resolve by box code or numeric ID (admin/testing path).
   * Real: GET /agent/box/:identifier
   */
  async resolveBoxByIdentifier(identifier) {
    if (this.dummyMode) {
      return {
        success: true,
        otp: '4589',
        address: 'Building A, King Fahd Road, Riyadh',
        googleMaps: 'https://maps.google.com/?q=24.7136,46.6753',
        deliverySessionId: '12345',
        boxId: 7,
        boxCode: String(identifier),
        otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        mode: 'dummy',
      };
    }

    const { status, data } = await this.request(
      'GET',
      `/agent/box/${encodeURIComponent(identifier)}`
    );

    if (status === 200) {
      return {
        success: true,
        otp: data.otp,
        address: data.address,
        googleMaps: data.google_maps_link,
        deliverySessionId: String(data.delivery_session_id || ''),
        boxId: data.box_id,
        boxCode: data.box_code,
        otpExpiresAt: data.otp_expires_at,
      };
    }

    const error = new Error(data?.message || 'Failed to resolve box');
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  /**
   * Journey 2 – lookup customer by WhatsApp
   * Real: POST /agent/expected-deliveries/lookup-user
   */
  async findCustomer(payload) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] findCustomer: ${JSON.stringify(payload)}`);
      return {
        name: 'Mohammed',
        phone: payload.whatsappPhone || payload.phone || '+9665xxxx',
        locker: 'A12',
        userFound: true,
        boxes: [
          {
            boxId: 7,
            boxCode: 'A12',
            address: 'Building A, King Fahd Road, Riyadh',
          },
        ],
        mode: 'dummy',
      };
    }

    const { status, data } = await this.request('POST', '/agent/expected-deliveries/lookup-user', {
      body: { whatsapp_phone: payload.whatsappPhone || payload.phone },
    });

    if (status === 404 || data?.user_found === false) {
      return {
        name: null,
        phone: payload.whatsappPhone || payload.phone,
        locker: null,
        userFound: false,
        boxes: [],
      };
    }

    if (status === 200) {
      const primary = data.boxes?.[0];
      return {
        name: data.name || data.user_name || 'Customer',
        phone: payload.whatsappPhone || payload.phone,
        locker: primary?.box_code || null,
        userFound: true,
        boxes: (data.boxes || []).map((b) => ({
          boxId: b.box_id,
          boxCode: b.box_code,
          address: b.address,
        })),
      };
    }

    const error = new Error(data?.message || 'Failed to find customer');
    error.statusCode = status;
    error.details = data;
    throw error;
  }

  // -------------------------------------------------------------------------
  // Addendum 2 (owner endpoints) + v2.3 additions. These return { status, data } and let the
  // caller branch: every refusal carries a message written for a person.
  // -------------------------------------------------------------------------

  async _raw(method, path, body, opts = {}) {
    if (this.dummyMode) return { status: 501, data: { message: 'dummy mode' } };
    return this.request(method, path, { body, ...opts });
  }

  /** Read-only reference check: no code, no session, no status change. */
  peekReference(orderReference) {
    return this._raw('GET', `/agent/box/by-reference/${encodeURIComponent(orderReference)}?peek=true`);
  }

  /** reason: cod | box_unresponsive | parcel_too_large. The returned phone must never be stored. */
  driverContact({ orderReference, reason, conversationId, note, parcelCm } = {}) {
    return this._raw(
      'POST',
      '/agent/driver-contact',
      {
        order_reference: orderReference,
        reason,
        conversation_id: conversationId,
        ...(note ? { note: String(note).slice(0, 200) } : {}),
        ...(parcelCm ? { parcel_cm: parcelCm } : {}),
      },
      { noRetry: true }
    );
  }

  driverContactStatus(requestId, conversationId) {
    return this._raw(
      'GET',
      `/agent/driver-contact/${encodeURIComponent(requestId)}?conversation_id=${encodeURIComponent(conversationId)}`
    );
  }

  deliveryStatus(orderReference) {
    return this._raw('GET', `/agent/delivery/status/${encodeURIComponent(orderReference)}`);
  }

  /** filters: reference, date_from, date_to, status[], limit, include_finished */
  listDeliveries(whatsappPhone, filters = {}) {
    return this._raw('POST', '/agent/whatsapp/deliveries', { whatsapp_phone: whatsappPhone, ...filters });
  }

  cancelDelivery(whatsappPhone, deliveryId) {
    return this._raw(
      'POST',
      '/agent/whatsapp/deliveries/cancel',
      { whatsapp_phone: whatsappPhone, delivery_id: deliveryId },
      { noRetry: true }
    );
  }

  /** Without deliveryId: guest code. With deliveryId: replaces and revokes the driver's code. */
  issueCode(whatsappPhone, { boxId, deliveryId } = {}) {
    return this._raw(
      'POST',
      '/agent/whatsapp/code',
      {
        whatsapp_phone: whatsappPhone,
        ...(boxId ? { box_id: boxId } : {}),
        ...(deliveryId ? { delivery_id: deliveryId } : {}),
      },
      { noRetry: true }
    );
  }

  boxStatus(whatsappPhone, boxId) {
    return this._raw('POST', '/agent/whatsapp/box-status', {
      whatsapp_phone: whatsappPhone,
      ...(boxId ? { box_id: boxId } : {}),
    });
  }

  /** category: box_fault | theft | damaged_parcel | other */
  reportIssue(whatsappPhone, { category, description, boxId, deliveryId } = {}) {
    return this._raw(
      'POST',
      '/agent/whatsapp/report-issue',
      {
        whatsapp_phone: whatsappPhone,
        category,
        description: String(description || '').slice(0, 1000),
        ...(boxId ? { box_id: boxId } : {}),
        ...(deliveryId ? { delivery_id: deliveryId } : {}),
      },
      { noRetry: true }
    );
  }

  setPreferences(whatsappPhone, { whatsappOptOut, allowDriverContact } = {}) {
    return this._raw('POST', '/agent/whatsapp/preferences', {
      whatsapp_phone: whatsappPhone,
      ...(typeof whatsappOptOut === 'boolean' ? { whatsapp_opt_out: whatsappOptOut } : {}),
      ...(typeof allowDriverContact === 'boolean' ? { allow_driver_contact: allowDriverContact } : {}),
    });
  }

  async supportContact() {
    const cached = this._supportCache;
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.value;
    const { status, data } = await this._raw('GET', '/agent/support-contact');
    const value = status === 200 ? data : { configured: false, app_hint: 'In the LLBox app: Settings, then Help' };
    if (status === 200) this._supportCache = { at: Date.now(), value };
    return value;
  }

  /**
   * Driver sent a cancelled reference. Starts the "ask the customer" question (acceptance Part 3).
   * 202 { request_id, status: waiting, wait_seconds }. Only a cancelled delivery starts it; else 404.
   */
  cancelledArrival({ orderReference, conversationId } = {}) {
    return this._raw(
      'POST',
      '/agent/cancelled-arrival',
      { order_reference: orderReference, conversation_id: conversationId },
      { noRetry: true }
    );
  }

  cancelledArrivalStatus(requestId, conversationId) {
    return this._raw(
      'GET',
      `/agent/cancelled-arrival/${encodeURIComponent(requestId)}?conversation_id=${encodeURIComponent(conversationId)}`
    );
  }

  /** Open questions waiting for a customer answer (worker polls this). */
  arrivalRequestsOpen() {
    return this._raw('GET', '/agent/arrival-requests/open');
  }

  /** What is waiting on this WhatsApp number to answer (YES/NO matching). */
  arrivalRequestsFor(whatsappPhone) {
    return this._raw('POST', '/agent/whatsapp/arrival-requests', { whatsapp_phone: whatsappPhone });
  }

  /** Customer's YES/NO. First answer wins. */
  arrivalRespond(whatsappPhone, requestId, approve) {
    return this._raw(
      'POST',
      '/agent/whatsapp/arrival-requests/respond',
      { whatsapp_phone: whatsappPhone, request_id: requestId, approve: Boolean(approve) },
      { noRetry: true }
    );
  }
}

module.exports = new LlboxService();
