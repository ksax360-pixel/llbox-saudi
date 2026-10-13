/**
 * Deterministic WhatsApp turn pipeline (Test Report 2026-09-30 §5.1):
 *   dedupe → normalise → identify → classify (rules) → by-reference / notify-recipient / register
 *   → reply rendered from templates using ONLY this turn's tool results.
 * The LLM draft is used only for general questions from recognised LLBox customers, after sanitising.
 */

const crypto = require('crypto');
const TurnState = require('../models/TurnState');
const llboxService = require('./llbox.service');
const journeyService = require('./journey.service');
const followUpService = require('./followup.service');
const issueClassifier = require('./issue-classifier.service');
const ownerFlow = require('./owner.flow');
const contactFlow = require('./contact.flow');
const logger = require('../config/logger');
const { normalizePhone, digitsOnly } = require('../utils/phone');
const { one, DIVIDER } = require('./templates.service');
const { buildDriverRefusalMessage } = require('./message.service');
const {
  normalizeInbound,
  refKey,
  detectInboundLanguage,
  renderModeFor,
  extractReferences,
  extractOcrReference,
  classifyInbound,
  classifyEmojiOnly,
  parseDims,
} = require('./inbound.service');

const DEDUPE_WINDOW_MS = 5 * 1000;
const PENDING_ISSUE_TTL_MS = 10 * 60 * 1000;
const FAILED_ATTEMPT_TTL_MS = 30 * 60 * 1000;
const HANDOVER_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const LANGUAGE_TTL_MS = 24 * 60 * 60 * 1000;
// identify runs on every message (Test Report 2026-10-04 F4/F5); the cache is only used when the live call fails.
const IDENTITY_FALLBACK_TTL_MS = 30 * 60 * 1000;
const identityCache = new Map();
const LLM_ISSUE_MAP = {
  code_not_working: { stuckIssue: 'code_not_working' },
  parcel_too_large: { stuckIssue: 'parcel_too_large' },
  box_full: { stuckIssue: 'box_full' },
  cannot_find_box: { stuckIssue: 'cannot_find_box' },
  customer_no_answer: { stuckIssue: 'other', customerNoAnswer: true },
  contact_request: { stuckIssue: 'other', contactRequest: true },
  off_box: { stuckIssue: 'other', offBox: true },
  cod: { codRequest: true },
  completed: { completionClaim: true },
};

/** Strip anything the LLM must never say (codes, handoff claims, filler closers). */
const sanitizeAiReply = (text = '') => {
  const s = String(text || '').trim();
  if (!s) return '';
  if (/\b\d{4,8}\b/.test(s)) return '';
  if (/(connect|transfer|escalat|pass|forward)\w*[^.]{0,40}\b(human|agent|person|team|support|staff)\b/i.test(s)) return '';
  if (/(feel free to ask|how can i (help|assist)|let me know if you (have|need) any|provide more details|clarify your request)/i.test(s)) return '';
  if (/^\s*[{[]/.test(s)) return '';
  return s;
};

const hashText = (phoneDigits, normalized) =>
  crypto.createHash('sha1').update(`${phoneDigits}|${normalized.toLowerCase()}`).digest('hex');

class TurnService {
  async _claimTurn(phoneDigits, hash) {
    if (!hash) {
      const state = await TurnState.findOneAndUpdate(
        { phoneDigits },
        { $setOnInsert: { phoneDigits } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      return { duplicate: false, state };
    }
    const now = new Date();
    try {
      const state = await TurnState.findOneAndUpdate(
        {
          phoneDigits,
          $or: [
            { lastTextHash: { $ne: hash } },
            { lastTextAt: { $lt: new Date(now.getTime() - DEDUPE_WINDOW_MS) } },
            { lastTextAt: null },
          ],
        },
        { $set: { lastTextHash: hash, lastTextAt: now } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      return { duplicate: false, state };
    } catch (error) {
      if (error && error.code === 11000) return { duplicate: true, state: null };
      throw error;
    }
  }

  async _identify(phoneE164, state = {}) {
    try {
      const result = await llboxService.identifyWhatsapp(phoneE164);
      identityCache.set(phoneE164, { result, at: Date.now() });
      if (identityCache.size > 5000) identityCache.delete(identityCache.keys().next().value);
      return result;
    } catch (error) {
      const hit = identityCache.get(phoneE164);
      const cached = hit && Date.now() - hit.at < IDENTITY_FALLBACK_TTL_MS ? hit : null;
      const stored = state.identity?.userFound ? state.identity : null;
      logger.warn(
        `[turn] identify failed (${error.statusCode || '-'}): ${error.message}` +
          (cached ? ' (using cached identity)' : stored ? ' (using stored identity)' : '')
      );
      if (cached) return { ...cached.result, fromState: true };
      if (stored) {
        return { userFound: true, recipientName: stored.recipientName, boxes: stored.boxes, summary: '', fromState: true };
      }
      return { userFound: false, error: error.message };
    }
  }

  /**
   * @param {object} payload { phone, text, inputType, mediaContext, mediaReadOk, aiReply, messageId, correlationId }
   */
  async handle(payload = {}) {
    const phoneE164 = normalizePhone(payload.phone || payload.whatsappPhone || '');
    const phoneDigits = digitsOnly(phoneE164);
    const raw = String(payload.text ?? payload.messageText ?? '').slice(0, 2000);
    const inputType = String(payload.inputType || 'text').toLowerCase();
    const isMedia = inputType === 'image' || inputType === 'document';
    const mediaContext = String(payload.mediaContext || '');
    const mediaFailed = isMedia && (/^MEDIA_READ_FAILED/i.test(mediaContext) || payload.mediaReadOk === false);
    const normalized = normalizeInbound(raw);

    if (!phoneDigits) {
      return { success: false, outcome: 'error', reply: one('fallback', 'en'), suppress: false };
    }

    const { duplicate, state: claimed } = await this._claimTurn(
      phoneDigits,
      !isMedia && normalized ? hashText(phoneDigits, normalized) : ''
    );
    if (duplicate) {
      logger.info(`[turn] duplicate suppressed for ${phoneDigits}: ${normalized.slice(0, 60)}`);
      return { success: true, outcome: 'duplicate_suppressed', suppress: true, reply: '' };
    }
    const state = claimed || {};

    const now = Date.now();
    const { candidates, tooShort, junk } = extractReferences(normalized);
    const ocrRef = isMedia && !mediaFailed ? extractOcrReference(mediaContext) : '';
    const refs = [...(ocrRef ? [ocrRef] : []), ...candidates].filter(
      (r, i, arr) => arr.findIndex((x) => refKey(x) === refKey(r)) === i
    );

    const detected = detectInboundLanguage(normalized, { exclude: candidates });
    const storedMode =
      state.languageAt && now - new Date(state.languageAt).getTime() < LANGUAGE_TTL_MS
        ? state.languageMode
        : [];
    let mode = renderModeFor(detected, storedMode);
    // "???", emoji, stickers: no language to mirror, so answer in both (R4 / scenario 28).
    if (detected === 'none' && !refs.length && !storedMode.length && mode.length === 1) {
      mode = mode[0] === 'en' ? ['en', 'ar'] : ['ar', 'en'];
    }

    const identity = await this._identify(phoneE164, state);
    const isCustomer = Boolean(identity.userFound);
    const cls = classifyInbound(normalized);

    const ctx = {
      payload,
      phoneE164,
      phoneDigits,
      raw,
      normalized,
      inputType,
      isMedia,
      mediaContext,
      mediaFailed,
      refs,
      ocrRef,
      tooShort,
      junk,
      detected,
      mode,
      identity,
      isCustomer,
      cls,
      state,
      now,
      updates: { $set: {}, $unset: {} },
    };
    if (identity.userFound && !identity.fromState) {
      // Fallback identity never keeps a box phone number or a code (LLBox PDPL note).
      ctx.updates.$set.identity = {
        userFound: true,
        recipientName: identity.recipientName || '',
        boxes: (identity.boxes || []).map((b) => ({
          boxId: b.boxId,
          boxCode: b.boxCode,
          nickname: b.nickname,
          status: b.status,
          yourRole: b.yourRole,
          health: b.health,
        })),
        at: new Date(now),
      };
    } else if (!identity.userFound && !identity.error && state.identity?.userFound) {
      ctx.updates.$unset.identity = 1;
    }
    if (detected !== 'none') {
      ctx.updates.$set.languageMode = mode;
      ctx.updates.$set.languageAt = new Date(now);
    }

    let result;
    try {
      // Product rule: a number identify recognises is always an owner, whatever the message says (O23).
      const ownerMode = isCustomer;
      ctx.ownerMode = ownerMode;
      result = ownerMode ? await this._ownerTurn(ctx) : await this._driverTurn(ctx);
    } catch (error) {
      logger.error(`[turn] pipeline error for ${phoneDigits}: ${error.stack || error.message}`);
      result = { outcome: 'error_fallback', reply: this._say(ctx, 'fallback') };
    }

    ctx.updates.$set.lastTemplate = result.template || result.outcome || '';
    const update = {};
    if (Object.keys(ctx.updates.$set).length) update.$set = ctx.updates.$set;
    if (Object.keys(ctx.updates.$unset).length) update.$unset = ctx.updates.$unset;
    if (ctx.updates.$push) update.$push = ctx.updates.$push;
    if (Object.keys(update).length) {
      await TurnState.updateOne({ phoneDigits }, update).catch((err) =>
        logger.warn(`[turn] state save failed: ${err.message}`)
      );
    }

    logger.info(
      `[turn] ${phoneDigits} lang=${detected} mode=${mode.join('+')} customer=${isCustomer} owner=${Boolean(ctx.ownerMode)} refs=${JSON.stringify(refs)} outcome=${result.outcome}`
    );

    return {
      success: true,
      suppress: false,
      actor: ctx.ownerMode ? 'customer' : 'driver',
      language: detected,
      languages: mode,
      references: refs,
      boxPhotos: [],
      ...result,
      reply: String(result.reply || '').trim() || this._say(ctx, 'fallback'),
    };
  }

  // -------------------------------------------------------------------------
  // Rendering helpers
  // -------------------------------------------------------------------------

  _say(ctx, key, vars = {}, modeOverride) {
    const mode = modeOverride || ctx.mode;
    return mode.map((lang) => one(key, lang, typeof vars === 'function' ? vars(lang) : vars)).join(DIVIDER);
  }

  /** Compose per-language blocks so bilingual replies are never interleaved (ref p6). */
  _compose(ctx, partsByLang) {
    return ctx.mode
      .map((lang) => partsByLang(lang).filter(Boolean).join('\n\n'))
      .filter(Boolean)
      .join(DIVIDER);
  }

  _openerMode(ctx) {
    if (ctx.detected === 'ar') return ['ar'];
    if (ctx.detected === 'en') return ['en', 'ar'];
    return ctx.mode.length > 1 ? ctx.mode : ['ar', 'en'];
  }

  _handoverFor(ctx, ref) {
    const key = refKey(ref);
    return (ctx.state.handovers || []).find(
      (h) => h.refKey === key && ctx.now - new Date(h.at).getTime() < HANDOVER_TTL_MS
    );
  }

  _recordHandover(ctx, result) {
    const ref = result.orderReference;
    const entry = {
      ref,
      refKey: refKey(ref),
      at: new Date(ctx.now),
      address: result.address || '',
      googleMaps: result.googleMaps || '',
      boxPhotos: result.boxPhotos || [],
    };
    const kept = (ctx.state.handovers || [])
      .filter((h) => h.refKey !== entry.refKey && ctx.now - new Date(h.at).getTime() < HANDOVER_TTL_MS)
      .slice(-9);
    ctx.updates.$set.handovers = [...kept, entry];
    ctx.state.handovers = [...kept, entry];
  }

  _resetFailures(ctx) {
    ctx.updates.$set.failedAttempts = 0;
  }

  _countFailure(ctx) {
    const last = ctx.state.lastFailedAt ? new Date(ctx.state.lastFailedAt).getTime() : 0;
    const prior = ctx.now - last < FAILED_ATTEMPT_TTL_MS ? Number(ctx.state.failedAttempts || 0) : 0;
    const attempts = prior + 1;
    ctx.updates.$set.failedAttempts = attempts;
    ctx.updates.$set.lastFailedAt = new Date(ctx.now);
    return attempts;
  }

  _twoNumbersSuffix(ctx) {
    if (ctx.refs.length < 2) return () => '';
    return (lang) => one('twoNumbers', lang, { first: ctx.refs[0], second: ctx.refs[1] });
  }

  // -------------------------------------------------------------------------
  // Driver / unknown sender
  // -------------------------------------------------------------------------

  async _driverTurn(ctx) {
    const { cls, refs } = ctx;
    const pending = ctx.state.pendingIssue || {};
    const askedForRefLastTurn = /^(stuckAsk_|contactRequest$|offBox$|codAsk$)/.test(ctx.state.lastTemplate || '');
    const pendingAge = pending.at ? ctx.now - new Date(pending.at).getTime() : Infinity;
    const pendingFresh = Boolean(pending.issue) && askedForRefLastTurn && pendingAge < PENDING_ISSUE_TTL_MS;
    const pendingDims =
      pending.step === 'dims' && pending.ref && ctx.state.lastTemplate === 'parcelAskSize' && pendingAge < PENDING_ISSUE_TTL_MS;
    if (pending.issue) ctx.updates.$unset.pendingIssue = 1;

    if (ctx.inputType === 'sticker') {
      return { outcome: 'sticker', template: 'stickerReceived', reply: this._say(ctx, 'stickerReceived') };
    }
    if (ctx.isMedia && !refs.length) {
      return { outcome: 'photo_unreadable', template: 'photoUnreadable', reply: this._say(ctx, 'photoUnreadable') };
    }

    if (pendingDims) {
      const dims = parseDims(ctx.normalized);
      const otherRef = refs.length && refKey(refs[0]) !== refKey(pending.ref);
      if (dims) return this._oversized(ctx, pending.ref, pending.note, dims);
      if (!otherRef) return this._stuckWithRef(ctx, pending.ref, 'parcel_too_large', pending.note || ctx.raw, { issues: ['parcel_too_large'] });
    }

    const retry = this._retryFollowUp(ctx);
    if (retry) {
      ctx.updates.$unset.contactRetry = 1;
      return this._stuckWithRef(ctx, retry.ref, retry.issue, ctx.raw, { issues: [retry.issue] });
    }

    if (cls.manipulation) {
      return { outcome: 'manipulation_refused', template: 'manipulationRefused', reply: this._say(ctx, 'manipulationRefused') };
    }

    // Roman Hindi / Hinglish problems the rules miss (R1): ask the model to classify, never to reply.
    const ruleHit =
      cls.stuckIssue || cls.codRequest || cls.completionClaim || cls.manipulation || cls.humanRequest || cls.locationRequest || cls.botQuestion;
    if (!ruleHit && issueClassifier.worthClassifying(ctx.normalized, refs)) {
      const llm = LLM_ISSUE_MAP[await issueClassifier.classify(ctx.normalized)];
      // Never invent a COD request when the message negates COD / looks prepaid (D37).
      if (llm && !(llm.codRequest && cls.codNegated)) {
        Object.assign(cls, llm);
        if (llm.stuckIssue) cls.issues = [...(cls.issues || []), llm.stuckIssue];
        ctx.llmIssue = true;
      }
    }

    const boxProblem = ['code_not_working', 'parcel_too_large', 'box_full', 'cannot_find_box'].includes(cls.stuckIssue);
    if (cls.codRequest && !boxProblem) {
      if (refs.length) return this._contactCod(ctx, refs[0], ctx.raw);
      ctx.updates.$unset.contactRetry = 1;
      delete ctx.updates.$unset.pendingIssue;
      ctx.updates.$set.pendingIssue = { issue: 'cod', note: ctx.raw.slice(0, 500), at: new Date(ctx.now) };
      return { outcome: 'cod_needs_reference', intent: 'driver_contact', template: 'codAsk', reply: this._say(ctx, 'codAsk') };
    }

    if (cls.stuckIssue) {
      if (refs.length) {
        return this._issueWithRef(ctx, refs[0], cls.stuckIssue, ctx.raw, cls);
      }
      // New ask with no order number: never keep the previous order's retry marker (D26).
      ctx.updates.$unset.contactRetry = 1;
      delete ctx.updates.$unset.pendingIssue;
      ctx.updates.$set.pendingIssue = { issue: cls.stuckIssue, note: ctx.raw.slice(0, 500), at: new Date(ctx.now) };
      let template = `stuckAsk_${cls.stuckIssue}`;
      if (cls.stuckIssue === 'other') template = cls.offBox ? 'offBox' : 'contactRequest';
      return { outcome: 'stuck_needs_reference', intent: 'stuck_driver', issue: cls.stuckIssue, template, reply: this._say(ctx, template) };
    }

    if (refs.length) {
      if (pendingFresh) {
        const pendingCls = {
          contactRequest: pending.issue === 'other' && !/guard|security|gate|door|الحارس/i.test(pending.note),
          offBox: pending.issue === 'other' && /guard|security|watchman|neighbo|reception|no need|الحارس|الأمن/i.test(pending.note),
          issues: [pending.issue],
        };
        return this._issueWithRef(ctx, refs[0], pending.issue, pending.note || ctx.raw, pendingCls);
      }
      return this._lookup(ctx, refs[0], { completionClaim: cls.completionClaim });
    }

    if (ctx.tooShort) {
      return { outcome: 'too_short', template: 'tooShort', reply: this._say(ctx, 'tooShort') };
    }
    if (cls.completionClaim) {
      const last = (ctx.state.handovers || []).slice(-1)[0];
      if (last && ctx.now - new Date(last.at).getTime() < HANDOVER_TTL_MS) {
        const { status, data } = await llboxService.deliveryStatus(last.ref).catch(() => ({ status: 0 }));
        if (status === 200 && data?.completed) {
          return { outcome: 'completion_confirmed', template: 'completionConfirmed', orderReference: last.ref, reply: this._say(ctx, 'completionConfirmed', { ref: last.ref }) };
        }
      }
      return { outcome: 'completion_claim', template: 'completionClaim', reply: this._say(ctx, 'completionClaim') };
    }
    const emoji = classifyEmojiOnly(ctx.raw);
    if (emoji === 'thanks' && (ctx.state.handovers || []).length) {
      return { outcome: 'thanks', template: 'thanks', reply: this._say(ctx, 'thanks') };
    }
    if (emoji === 'delivering') {
      return { outcome: 'ask_reference', template: 'askReferenceDelivering', reply: this._say(ctx, 'askReferenceDelivering') };
    }
    if (cls.ownerClaim) {
      return { outcome: 'owner_claim_refused', template: 'ownerClaim', reply: this._say(ctx, 'ownerClaim') };
    }
    if (cls.humanRequest) {
      return { outcome: 'human_request', template: 'humanRequest', reply: this._say(ctx, 'humanRequest') };
    }
    if (cls.damagedLabel) {
      return { outcome: 'ask_photo', template: 'askPhoto', reply: this._say(ctx, 'askPhoto') };
    }
    if (cls.locationRequest || cls.codeRequest) {
      return { outcome: 'ask_reference', template: 'askReference', reply: this._say(ctx, 'askReference') };
    }
    if (cls.delivering || (cls.yes && ctx.state.lastTemplate === 'opener')) {
      return { outcome: 'ask_reference', template: 'askReferenceDelivering', reply: this._say(ctx, 'askReferenceDelivering') };
    }
    if (cls.infoRequest) {
      return { outcome: 'product_info', template: 'productInfo', reply: this._say(ctx, 'productInfo') };
    }
    if (cls.greetingOnly) {
      return { outcome: 'opener', template: 'opener', reply: this._say(ctx, 'opener', {}, this._openerMode(ctx)) };
    }
    if (cls.thanks) {
      return { outcome: 'thanks', template: 'thanks', reply: this._say(ctx, 'thanks') };
    }
    return { outcome: ctx.junk ? 'junk_fallback' : 'fallback', template: 'fallback', reply: this._say(ctx, 'fallback') };
  }

  async _resolve(ctx, ref, extra = {}) {
    return journeyService.handleDriverVerification(ref, {
      phone: ctx.phoneE164,
      messageText: ctx.raw,
      languages: ctx.mode,
      correlationId: ctx.payload.correlationId,
      intent: 'resolve_delivery_access',
      ...extra,
    });
  }

  async _lookup(ctx, ref, { completionClaim = false } = {}) {
    const result = await this._resolve(ctx, ref);
    const suffix = this._twoNumbersSuffix(ctx);
    const base = {
      orderReference: result.orderReference || ref,
      reason: result.reason || null,
      notified: result.notified,
    };

    if (result.success) {
      this._resetFailures(ctx);
      this._recordHandover(ctx, result);
      await followUpService
        .scheduleDeliveryStatus({ phoneDigits: ctx.phoneDigits, ref: result.orderReference || ref, languages: ctx.mode })
        .catch((err) => logger.warn(`[turn] schedule delivery status failed: ${err.message}`));
      const cod = result.paymentType === 'cod';
      return {
        ...base,
        outcome: 'handover',
        template: 'handover',
        boxPhotos: result.boxPhotos || [],
        otpIssued: true,
        reply: this._compose(ctx, (lang) => [result.sayByLanguage?.[lang], cod ? one('codHandoverNote', lang) : '', suffix(lang)]),
      };
    }

    const reason = result.reason;
    const handedHere = this._handoverFor(ctx, ref);

    if (reason === 'already_matched' && handedHere) {
      this._resetFailures(ctx);
      const key = completionClaim ? 'completionClaim' : 'codeAlreadySent';
      return {
        ...base,
        outcome: completionClaim ? 'completion_claim' : 'code_already_sent_here',
        template: key,
        reply: this._compose(ctx, (lang) => [one(key, lang, { ref: handedHere.ref }), suffix(lang)]),
      };
    }

    if (reason === 'cancelled') {
      return this._cancelledArrival(ctx, result.orderReference || ref);
    }

    if (reason === 'not_found' || reason === 'ambiguous') {
      const attempts = this._countFailure(ctx);
      if (attempts >= 2) {
        return {
          ...base,
          outcome: 'second_failure',
          template: 'secondFailure',
          attempts,
          reply: this._compose(ctx, (lang) => [one('secondFailure', lang), suffix(lang)]),
        };
      }
      return {
        ...base,
        outcome: reason,
        attempts,
        reply: this._compose(ctx, (lang) => [result.sayByLanguage?.[lang], suffix(lang)]),
      };
    }

    this._resetFailures(ctx);
    return {
      ...base,
      outcome: reason || result.outcome || 'refused',
      reply: this._compose(ctx, (lang) => [result.sayByLanguage?.[lang] || one('lookupError', lang), suffix(lang)]),
    };
  }

  /** Driver arrived for a cancelled delivery → ask the customer first (acceptance Part 3). */
  async _cancelledArrival(ctx, ref) {
    const conversationId = contactFlow.conversationIdFor(ctx.phoneDigits);
    const { status, data } = await llboxService.cancelledArrival({
      orderReference: ref,
      conversationId,
    });
    logger.info(`[arrival] ${ref} status=${status} request=${data?.request_id || '-'} state=${data?.status || data?.reason || '-'}`);
    if ((status === 202 || status === 200) && data?.request_id) {
      this._resetFailures(ctx);
      await followUpService
        .scheduleCancelledArrival({
          phoneDigits: ctx.phoneDigits,
          ref,
          requestId: data.request_id,
          conversationId,
          languages: ctx.mode,
          waitSeconds: data.wait_seconds || 300,
        })
        .catch((err) => logger.warn(`[arrival] schedule failed: ${err.message}`));
      return {
        outcome: 'cancelled_arrival_waiting',
        template: 'cancelledArrivalAsk',
        orderReference: ref,
        reply: this._say(ctx, 'cancelledArrivalAsk'),
      };
    }
    // Not a cancelled delivery after all (or API refused): keep the usual cancelled wording.
    return {
      outcome: 'cancelled',
      orderReference: ref,
      reply: this._compose(ctx, (lang) => [buildDriverRefusalMessage('cancelled', { language: lang })]),
    };
  }

  async _stuckWithRef(ctx, ref, issue, note, cls = {}) {
    const issues = cls.issues || [issue];
    // A driver who asks where the box is, or who hasn't been given the box yet for a contact /
    // off-box problem, needs the handover (address, map, code) as well as the notify.
    const needsLocation =
      issues.includes('cannot_find_box') ||
      Boolean(ctx.cls.locationRequest) ||
      (issue === 'other' && !this._handoverFor(ctx, ref));
    const leadByLang = {};
    const bodyByLang = {};
    let boxPhotos = [];
    let notifyIssue = issue === 'other' ? 'other' : issue;
    let lookup = null;
    let otpIssued = false;
    let echoRef = ref;

    if (needsLocation) {
      const handed = this._handoverFor(ctx, ref);
      if (handed) {
        echoRef = handed.ref;
        boxPhotos = handed.boxPhotos || [];
        for (const lang of ctx.mode) {
          const lines = [one('addressAgain', lang, { ref: handed.ref })];
          if (handed.address) lines.push(`📍 ${handed.address}`);
          if (handed.googleMaps) {
            lines.push(`${lang === 'ar' ? 'الخريطة' : 'Map'}: ${handed.googleMaps.replace(/^https?:\/\//i, '')}`);
          }
          bodyByLang[lang] = lines.join('\n');
        }
      } else {
        lookup = await this._resolve(ctx, ref, { skipExpiredNotify: true });
        echoRef = lookup.orderReference || ref;
        if (lookup.success) {
          otpIssued = true;
          this._recordHandover(ctx, lookup);
          boxPhotos = lookup.boxPhotos || [];
        }
        if (lookup.reason === 'not_found') {
          this._countFailure(ctx);
          return {
            outcome: 'not_found',
            reason: 'not_found',
            orderReference: echoRef,
            reply: this._compose(ctx, (lang) => [lookup.sayByLanguage?.[lang]]),
          };
        }
        if (lookup.reason === 'expired') notifyIssue = 'reference_expired';
        for (const lang of ctx.mode) bodyByLang[lang] = lookup.sayByLanguage?.[lang] || '';
      }
    }

    const notify = await journeyService.handleNotifyRecipient({
      orderReference: echoRef,
      issue: notifyIssue,
      note: String(note || '').slice(0, 500),
    });

    let leadKey = `stuckLead_${issue}`;
    if (issue === 'other' && cls.contactRequest) leadKey = 'stuckLead_contact';
    if (issue === 'other' && cls.offBox) leadKey = 'stuckLead_offbox';
    const resultKey = notify.outcome === 'error' ? 'notifyError' : notify.notified ? 'notified' : 'notNotified';

    for (const lang of ctx.mode) {
      leadByLang[lang] = bodyByLang[lang] && ['stuckLead_cannot_find_box', 'stuckLead_other'].includes(leadKey)
        ? ''
        : one(leadKey, lang, { ref: echoRef });
    }

    return {
      outcome: notify.notified ? 'stuck_notified' : notify.outcome === 'error' ? 'stuck_notify_error' : 'stuck_not_notified',
      intent: 'stuck_driver',
      issue: notifyIssue,
      notified: Boolean(notify.notified),
      orderReference: echoRef,
      boxPhotos,
      otpIssued,
      reply: this._compose(ctx, (lang) => [bodyByLang[lang], leadByLang[lang], one(resultKey, lang)]),
    };
  }

}

Object.assign(TurnService.prototype, ownerFlow, contactFlow);

module.exports = new TurnService();
module.exports.sanitizeAiReply = sanitizeAiReply;
