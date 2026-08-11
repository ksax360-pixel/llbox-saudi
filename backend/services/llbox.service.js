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

  async request(method, path, { body, retried = false } = {}) {
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

      if (response.status === 500 && !retried) {
        logger.warn(`LLBox 500 on ${method} ${path} – retrying once`);
        return this.request(method, path, { body, retried: true });
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
   */
  async resolveDelivery(orderReference) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] resolveDelivery: ${orderReference}`);
      return {
        success: true,
        otp: '4589',
        address: 'Building A, King Fahd Road, Riyadh',
        googleMaps: 'https://maps.google.com/?q=24.7136,46.6753',
        deliverySessionId: '12345',
        boxId: 7,
        boxCode: 'A12',
        otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        orderReference,
        mode: 'dummy',
      };
    }

    const { status, data } = await this.request(
      'GET',
      `/agent/box/by-reference/${encodeURIComponent(orderReference)}`
    );

    if (status === 200) {
      return {
        success: true,
        otp: data.otp,
        address: data.address,
        googleMaps: data.google_maps_link,
        deliverySessionId: String(data.delivery_session_id),
        boxId: data.box_id,
        boxCode: data.box_code,
        otpExpiresAt: data.otp_expires_at,
        orderReference,
      };
    }

    const error = new Error(data?.message || 'Failed to resolve delivery');
    error.statusCode = status;
    error.details = data;
    throw error;
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
        mode: 'dummy',
      };
    }

    const body = {
      whatsapp_phone: payload.whatsappPhone,
      order_reference: payload.orderReference,
      ...(payload.boxId ? { box_id: payload.boxId } : {}),
    };

    const { status, data } = await this.request('POST', '/agent/expected-deliveries', { body });

    if (status === 201) {
      return {
        success: true,
        message: 'Delivery Registered',
        expectedDeliveryId: data.expected_delivery_id,
        boxCode: data.box_code,
      };
    }

    const error = new Error(data?.message || 'Failed to register delivery');
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
}

module.exports = new LlboxService();
