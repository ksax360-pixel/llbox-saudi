const llboxService = require('./llbox.service');
const opsService = require('./ops.service');
const Delivery = require('../models/Delivery');
const logger = require('../config/logger');
const { normalizePhone } = require('../utils/phone');
const {
  detectLanguage,
  buildDriverHandoverMessage,
  buildDriverRefusalMessage,
  normalizeBoxPhotos,
} = require('./message.service');

const { DIVIDER, one } = require('./templates.service');

const toLanguages = (language, languages) => {
  if (Array.isArray(languages) && languages.length) return languages;
  if (language === 'mixed') return ['ar', 'en'];
  return [language === 'ar' ? 'ar' : 'en'];
};

const mapResolvedBox = (data, orderReference, extras = {}) => {
  const languages = toLanguages(extras.language, extras.languages);
  const language = languages[0];
  const boxPhotos = normalizeBoxPhotos(data, { languages });
  const ref = data.orderReference || orderReference;
  const sayByLanguage = {};
  for (const lang of languages) {
    sayByLanguage[lang] = buildDriverHandoverMessage(
      { ...data, boxPhotos },
      { language: lang, orderReference: ref }
    );
  }
  const say = languages.map((lang) => sayByLanguage[lang]).join(DIVIDER);
  const { languages: _omit, ...rest } = extras;
  return {
    success: true,
    outcome: 'resolved',
    say,
    sayByLanguage,
    handoverMessage: say,
    language,
    otp: data.otp,
    address: data.address,
    addressArabic: data.addressArabic || null,
    googleMaps: data.googleMaps,
    deliverySessionId: data.deliverySessionId,
    boxId: data.boxId,
    boxCode: data.boxCode,
    boxStatus: data.boxStatus,
    boxPhotoUrl: data.boxPhotoUrl || boxPhotos[0]?.url || null,
    boxPhotos,
    otpExpiresAt: data.otpExpiresAt,
    recipientName: data.recipientName,
    paymentType: data.paymentType,
    codAmount: data.codAmount,
    latitude: data.latitude,
    longitude: data.longitude,
    orderReference: ref,
    deliveryStatus: 'matched',
    ...rest,
    language,
    languages,
  };
};

class JourneyService {
  /**
   * Journey 1 — Driver/rider at the box with an order reference.
   * Resolves reference → locker + OTP for keypad entry.
   */
  async handleDriverVerification(orderReference, meta = {}) {
    const ref = String(orderReference || '').trim();
    const languages = toLanguages(
      detectLanguage(meta.messageText || meta.text || meta.language || ''),
      meta.languages
    );
    const language = languages[0];
    if (!ref) {
      return {
        success: false,
        outcome: 'error',
        reason: 'missing_reference',
        say: languages.map((l) => one('askReference', l)).join(DIVIDER),
        orderReference: ref,
        language,
      };
    }

    try {
      const data = await llboxService.resolveDelivery(ref);
      const result = mapResolvedBox(data, ref, {
        driverPhone: meta.driverPhone || meta.phone || undefined,
        correlationId: meta.correlationId,
        languages,
      });

      await opsService.recordResolve(ref, data).catch((err) => {
        logger.warn(`Ops persist resolve failed: ${err.message}`);
      });

      if (meta.phone) {
        await opsService
          .touchWhatsAppContact({
            phone: meta.phone,
            lastOrderReference: ref,
            lastIntent: meta.intent || 'resolve_delivery_access',
          })
          .catch(() => {});
      }

      return result;
    } catch (error) {
      const refusal = this._mapResolveError(error, ref, languages);
      if (refusal.reason === 'expired' && !meta.skipExpiredNotify) {
        // Ref p12 + report #29: only say the customer was told when notify-recipient returns notified:true.
        const notify = await this.handleNotifyRecipient({
          orderReference: ref,
          issue: 'reference_expired',
          note: String(meta.messageText || meta.text || '').slice(0, 500),
        });
        const key = notify.notified ? 'expiredNotified' : 'expiredNotNotified';
        for (const l of languages) {
          refusal.sayByLanguage[l] = `${buildDriverRefusalMessage('expired', { language: l })}\n\n${one(key, l)}`;
        }
        refusal.say = languages.map((l) => refusal.sayByLanguage[l]).join(DIVIDER);
        refusal.notified = Boolean(notify.notified);
        refusal.notifyOutcome = notify.outcome;
      }
      return refusal;
    }
  }

  _mapResolveError(error, orderReference, languagesInput = ['en']) {
    const languages = Array.isArray(languagesInput) ? languagesInput : toLanguages(languagesInput);
    const language = languages[0];
    const mapAll = (fn) => Object.fromEntries(languages.map((l) => [l, fn(l)]));
    const withSay = (sayByLanguage) => ({
      sayByLanguage,
      say: languages.map((l) => sayByLanguage[l]).join(DIVIDER),
    });
    const sayAll = (reason) => withSay(mapAll((l) => buildDriverRefusalMessage(reason, { language: l })));
    const status = error.statusCode || 500;
    const details = error.details || {};
    const reason = String(details.reason || details.code || '').toLowerCase();

    const KNOWN_404 = new Set(['not_found', 'expired', 'already_matched', 'already_completed', 'cancelled']);
    if (status === 404) {
      let mappedReason = KNOWN_404.has(reason) ? reason : '';
      if (!mappedReason) {
        const blob = `${error.message || ''} ${details.message || ''}`.toLowerCase();
        if (/expired/.test(blob)) mappedReason = 'expired';
        else if (/already_completed|completed/.test(blob)) mappedReason = 'already_completed';
        else if (/already_matched|matched/.test(blob)) mappedReason = 'already_matched';
        else if (/cancelled|canceled/.test(blob)) mappedReason = 'cancelled';
        else mappedReason = 'not_found';
      }
      return {
        success: false,
        outcome: 'not_claimable',
        reason: mappedReason,
        ...sayAll(mappedReason),
        orderReference,
        language,
        deliveryStatus: mappedReason === 'already_completed' ? 'completed' : undefined,
      };
    }

    if (status === 403) {
      const r = reason || 'maintenance';
      return {
        success: false,
        outcome: 'box_unavailable',
        reason: r,
        ...sayAll(r),
        orderReference,
        language,
      };
    }

    if (status === 409) {
      const r = reason || 'ambiguous';
      // ambiguous | at_capacity (addendum 2.2) — never guess on ambiguous
      return {
        success: false,
        outcome: r === 'ambiguous' ? 'ambiguous' : 'conflict',
        reason: r,
        ...sayAll(r === 'at_capacity' ? r : 'ambiguous'),
        orderReference,
        language,
      };
    }

    return {
      success: false,
      outcome: status === 429 ? 'rate_limited' : 'error',
      reason: status === 429 ? 'rate_limit' : reason || 'upstream_error',
      ...withSay(mapAll((l) => one('lookupError', l))),
      orderReference,
      language,
      httpStatus: status,
    };
  }

  /**
   * Journey 1 fallback — manual confirm when box cannot take keypad code.
   */
  async handleConfirmDelivery(payload = {}) {
    try {
      const data = await llboxService.confirmDelivery(payload);
      await opsService.recordConfirm(payload, data).catch((err) => {
        logger.warn(`Ops persist confirm failed: ${err.message}`);
      });

      return {
        success: true,
        outcome: data.alreadyConfirmed ? 'already_completed' : 'completed',
        say: data.alreadyConfirmed ? 'Delivery was already confirmed.' : 'Delivery confirmed.',
        deliverySessionId: payload.deliverySessionId,
        boxId: payload.boxId,
        alreadyConfirmed: Boolean(data.alreadyConfirmed),
      };
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 401) {
        return {
          success: false,
          outcome: 'otp_mismatch',
          say: "That code doesn't match — please double-check with the driver.",
        };
      }
      return {
        success: false,
        outcome: 'error',
        say: error.message || "Couldn't confirm the delivery.",
        httpStatus: status,
      };
    }
  }

  /**
   * Journey 2 — WhatsApp registration before driver pickup.
   */
  async handleWhatsappRegistration(payload = {}) {
    const whatsappPhone = normalizePhone(payload.whatsappPhone || payload.phone || '');
    const orderReference = String(payload.orderReference || '').trim();
    const boxId = payload.boxId ? Number(payload.boxId) : undefined;
    const expectedDeliveryDate = payload.expectedDeliveryDate || payload.expected_delivery_date || undefined;

    if (!whatsappPhone || !orderReference) {
      return {
        success: false,
        outcome: 'error',
        say: 'WhatsApp number and order reference are both required.',
      };
    }

    try {
      const known = payload.identity;
      const lookup =
        known?.userFound && Array.isArray(known.boxes) && known.boxes.length
          ? { userFound: true, name: known.recipientName, boxes: known.boxes }
          : await llboxService.findCustomer({ whatsappPhone, phone: whatsappPhone });

      if (!lookup.userFound) {
        return {
          success: false,
          outcome: 'no_account',
          say: "I don't see an LLBox account linked to that number.",
          phone: whatsappPhone,
        };
      }

      if (!boxId && Array.isArray(lookup.boxes) && lookup.boxes.length > 1) {
        return {
          success: false,
          outcome: 'choose_box',
          say: 'This account has more than one box — which one is this delivery for?',
          boxes: lookup.boxes,
          phone: whatsappPhone,
          orderReference,
        };
      }

      const data = await llboxService.registerDelivery({
        whatsappPhone,
        orderReference,
        boxId: boxId || lookup.boxes?.[0]?.boxId,
        expectedDeliveryDate,
        paymentType: payload.paymentType,
        codAmount: payload.codAmount,
      });

      await opsService
        .recordRegister({
          whatsappPhone,
          orderReference,
          boxId: boxId || lookup.boxes?.[0]?.boxId,
          boxCode: data.boxCode,
          customerName: lookup.name,
        })
        .catch((err) => {
          logger.warn(`Ops persist register failed: ${err.message}`);
        });

      await opsService
        .touchWhatsAppContact({
          phone: whatsappPhone,
          name: lookup.name,
          lastOrderReference: orderReference,
          lastIntent: payload.intent || 'register_delivery',
        })
        .catch(() => {});

      let say = `I've registered delivery ${orderReference} for you${data.boxCode ? ` (${data.boxCode})` : ''}. The driver can request the code when they arrive.`;
      if (data.warning) say += `\n\n${data.warning}`;

      return {
        success: true,
        outcome: 'registered',
        say,
        expectedDeliveryId: data.expectedDeliveryId,
        boxCode: data.boxCode,
        expectedDeliveryDate: data.expectedDeliveryDate,
        expiresAt: data.expiresAt,
        warning: data.warning,
        deliveriesThatDay: data.deliveriesThatDay,
        paymentType: data.paymentType,
        codAmount: data.codAmount,
        orderReference,
        phone: whatsappPhone,
        deliveryStatus: 'pending',
      };
    } catch (error) {
      return this._mapRegisterError(error, { whatsappPhone, orderReference });
    }
  }

  _mapRegisterError(error, ctx) {
    const details = error.details || {};
    const code = String(details.code || '').toUpperCase();
    const status = error.statusCode || 500;

    if (status === 422 && code === 'BOX_SELECTION_REQUIRED') {
      return {
        success: false,
        outcome: 'choose_box',
        say: 'Which box is this delivery for?',
        boxes: details.boxes || [],
        ...ctx,
      };
    }
    if (status === 422 && code === 'NO_BOX_LINKED') {
      return {
        success: false,
        outcome: 'no_box',
        say: "That account doesn't have a box linked yet.",
        ...ctx,
      };
    }
    if (status === 403 && code === 'BOX_NOT_OWNED') {
      return {
        success: false,
        outcome: 'wrong_box',
        say: "That box isn't linked to this account.",
        ...ctx,
      };
    }
    if (status === 409 && code === 'REFERENCE_ALREADY_ACTIVE') {
      return {
        success: false,
        outcome: 'already_active',
        say: 'That reference is already registered on another account.',
        ...ctx,
      };
    }
    if (status === 409 && code === 'BOX_CAPACITY_EXCEEDED') {
      return {
        success: false,
        outcome: 'box_capacity_exceeded',
        say:
          details.message ||
          'That day is full for this box. Pick another day, or collect a parcel first.',
        expectedDeliveryDate: details.expected_delivery_date,
        deliveriesThatDay: details.deliveries_that_day,
        softLimit: details.soft_limit,
        hardLimit: details.hard_limit,
        ...ctx,
      };
    }
    if (status === 400 && (code === 'INVALID_EXPECTED_DATE' || /expected.?date/i.test(error.message))) {
      return {
        success: false,
        outcome: 'invalid_expected_date',
        say: details.message || 'That expected delivery date is not valid. Use YYYY-MM-DD, not in the past.',
        ...ctx,
      };
    }
    if (status === 400 && code === 'INVALID_PAYMENT') {
      return { success: false, outcome: 'invalid_payment', say: details.message || 'Invalid payment details.', ...ctx };
    }

    return {
      success: false,
      outcome: 'error',
      say: error.message || "Couldn't register the delivery.",
      ...ctx,
      httpStatus: status,
    };
  }

  /**
   * Customer locker lookup (Journey 2 pre-step).
   */
  async handleFindCustomer(payload = {}) {
    const whatsappPhone = normalizePhone(payload.whatsappPhone || payload.phone || '');
    if (!whatsappPhone) {
      return {
        success: false,
        outcome: 'error',
        say: 'A WhatsApp phone number is required.',
      };
    }

    try {
      const data = await llboxService.findCustomer({ whatsappPhone, phone: whatsappPhone });
      await opsService.recordFindCustomer(payload, data).catch(() => {});

      if (!data.userFound) {
        return {
          success: true,
          outcome: 'no_account',
          say: "I don't see an LLBox account linked to that number.",
          userFound: false,
          phone: whatsappPhone,
          boxes: [],
        };
      }

      return {
        success: true,
        outcome: 'found',
        say:
          data.boxes?.length > 1
            ? `Found ${data.boxes.length} lockers on this account.`
            : `Your locker is ${data.locker || data.boxes?.[0]?.boxCode || 'linked'}.`,
        name: data.name,
        phone: whatsappPhone,
        locker: data.locker,
        userFound: true,
        boxes: data.boxes || [],
      };
    } catch (error) {
      return {
        success: false,
        outcome: 'error',
        say: error.message || 'Customer lookup failed.',
        phone: whatsappPhone,
      };
    }
  }

  /**
   * OTP validation — LLBox always returns HTTP 200; check data.valid.
   */
  async handleValidateOtp(payload = {}) {
    try {
      const result = await llboxService.validateOtp(payload);
      const valid = Boolean(result.valid);

      if (valid && payload.orderReference) {
        await Delivery.findOneAndUpdate(
          { orderReference: payload.orderReference },
          { $set: { otpStatus: 'verified' } }
        ).catch(() => {});
      }

      return {
        success: valid,
        outcome: valid ? 'valid' : 'invalid',
        valid,
        reason: result.reason || null,
        expiresAt: result.expires_at || result.expiresAt || null,
        say: valid
          ? 'OTP verified successfully.'
          : result.reason === 'expired'
            ? 'That OTP has expired — request a new one.'
            : "That OTP doesn't match — please check and try again.",
      };
    } catch (error) {
      return {
        success: false,
        outcome: 'error',
        valid: false,
        say: error.message || 'OTP validation failed.',
      };
    }
  }

  /**
   * Delivery status from local ops mirror (fast path for n8n).
   */
  async handleGetDeliveryStatus(orderReference) {
    const ref = String(orderReference || '').trim();
    if (!ref) {
      return {
        success: false,
        outcome: 'error',
        say: 'Order reference is required.',
      };
    }

    const delivery = await Delivery.findOne({ orderReference: ref }).lean();
    if (!delivery) {
      return {
        success: false,
        outcome: 'not_found',
        say: buildDriverRefusalMessage('not_found'),
        orderReference: ref,
      };
    }

    return {
      success: true,
      outcome: 'found',
      say: `Delivery ${ref} is ${delivery.status}.`,
      orderReference: ref,
      deliveryStatus: delivery.status,
      locker: delivery.lockerCode || null,
      boxId: delivery.lockerBoxId || null,
      address: delivery.lastAddress || null,
      googleMaps: delivery.lastGoogleMaps || null,
      sessionId: delivery.sessionId || null,
      driverPhone: delivery.driverPhone || null,
    };
  }

  async handleClearLockerSession(payload = {}) {
    try {
      const data = await llboxService.clearStuckLockerSession(payload);
      if (!data.success) {
        return {
          success: false,
          outcome: data.rateLimited ? 'rate_limited' : 'conflict',
          say: data.message || 'Could not clear locker session.',
          ...data,
        };
      }
      return {
        success: true,
        outcome: 'cleared',
        say: 'Locker session cleared — you can retry the order reference now.',
        boxId: data.boxId,
        boxCode: data.boxCode,
      };
    } catch (error) {
      return {
        success: false,
        outcome: 'error',
        say: error.message || 'Could not clear locker session.',
      };
    }
  }

  /** POST /agent/whatsapp/identify — first call on inbound WhatsApp. */
  async handleIdentify(payload = {}) {
    const whatsappPhone = normalizePhone(payload.whatsappPhone || payload.phone || '');
    if (!whatsappPhone) {
      return {
        success: false,
        outcome: 'error',
        say: 'A WhatsApp phone number is required.',
        userFound: false,
      };
    }
    try {
      const data = await llboxService.identifyWhatsapp(whatsappPhone);
      if (!data.userFound) {
        return {
          success: true,
          outcome: 'unknown_number',
          userFound: false,
          say: "👋 You've reached LLBox.\n\nAre you here to drop off a delivery, or would you like to know more about LLBox?",
          phone: whatsappPhone,
        };
      }
      return {
        success: true,
        outcome: 'known_recipient',
        userFound: true,
        say: data.summary
          ? `Hello ${data.recipientName || ''} 👋 This is LLBox.\n${data.summary}`
          : `Hello ${data.recipientName || ''} 👋 This is LLBox.`,
        ...data,
        phone: whatsappPhone,
      };
    } catch (error) {
      return {
        success: false,
        outcome: 'error',
        userFound: false,
        say: error.message || 'Could not identify this number.',
        phone: whatsappPhone,
      };
    }
  }

  /** POST /agent/whatsapp/notify-recipient */
  async handleNotifyRecipient(payload = {}) {
    const orderReference = String(payload.orderReference || payload.order_reference || '').trim();
    const issue = String(payload.issue || 'other').trim();
    const note = payload.note || '';
    if (!orderReference) {
      return {
        success: false,
        outcome: 'error',
        say: 'Order reference is required to notify the customer.',
      };
    }
    try {
      const data = await llboxService.notifyRecipient({ orderReference, issue, note });
      if (data.notified) {
        return {
          success: true,
          outcome: 'notified',
          notified: true,
          say: "I've let the customer know in their app and they should reply shortly.\nIf you can't wait, please follow your usual process for an undelivered parcel — nothing is recorded against you.",
          orderReference,
        };
      }
      return {
        success: true,
        outcome: 'not_notified',
        notified: false,
        say: "I don't have a customer registered against that number, so there's nobody I can notify from here. Please contact them through your delivery app.",
        orderReference,
      };
    } catch (error) {
      return {
        success: false,
        outcome: 'error',
        notified: false,
        say: error.message || 'Could not notify the customer.',
        orderReference,
      };
    }
  }
}

module.exports = new JourneyService();
