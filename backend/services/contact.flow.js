/**
 * Driver ↔ customer contact for the three cases a box cannot solve (Test Report 2026-10-04 Part C / F1, F2, F11):
 * cash on delivery, a box that does not respond, a parcel too large for the box.
 * Calls POST /agent/driver-contact with a stable per-driver conversation_id, only after the driver
 * has given an order number. The customer's number goes into this reply only — never stored or logged.
 * Mixed into TurnService.
 */

const crypto = require('crypto');
const llboxService = require('./llbox.service');
const followUpService = require('./followup.service');
const logger = require('../config/logger');
const { one } = require('./templates.service');
const { refKey, parseDims } = require('./inbound.service');

const RETRY_WINDOW_MS = 20 * 60 * 1000;

const conversationIdFor = (phoneDigits) =>
  `x360-${crypto.createHash('sha256').update(`llbox-driver|${phoneDigits}`).digest('hex').slice(0, 24)}`;

module.exports = {
  _conversationId(ctx) {
    return conversationIdFor(ctx.phoneDigits);
  },

  /** Dispatch a driver problem that now has a reference. */
  async _issueWithRef(ctx, ref, issue, note, cls = {}) {
    if (issue === 'cod') return this._contactCod(ctx, ref, note);
    if (issue === 'code_not_working') return this._deadBox(ctx, ref, note, cls);
    if (issue === 'parcel_too_large' && !(cls.issues || []).includes('box_full')) {
      return this._oversized(ctx, ref, note, parseDims(ctx.normalized), cls);
    }
    return this._stuckWithRef(ctx, ref, issue, note, cls);
  },

  async _driverContact(ctx, ref, reason, note, parcelCm) {
    const { status, data } = await llboxService.driverContact({
      orderReference: ref,
      reason,
      conversationId: this._conversationId(ctx),
      note: String(note || '').slice(0, 200),
      parcelCm,
    });
    logger.info(
      `[contact] ${ref} reason=${reason} status=${status} released=${Boolean(data?.released)} ` +
        `code=${data?.reason || data?.code || '-'} request=${data?.request_id || '-'} repeat=${Boolean(data?.repeat)}`
    );
    return { status, data: data || {} };
  },

  _released(ctx, ref, key, data, extra = {}) {
    const name = data.recipient_first_name || '';
    const phone = data.contact?.phone || '';
    return {
      outcome: 'contact_released',
      intent: 'driver_contact',
      orderReference: ref,
      contactReleased: true,
      reply: this._compose(ctx, (lang) => [
        one(key, lang, { name, phone, ...(typeof extra === 'function' ? extra(lang) : extra) }),
        data.customer_notified ? one('contactNotified', lang) : '',
        one('contactOneOff', lang),
      ]),
    };
  },

  _optedOut(ctx, ref) {
    return { outcome: 'contact_opted_out', orderReference: ref, template: 'contactOptedOut', reply: this._say(ctx, 'contactOptedOut') };
  },

  _retriedRecently(ctx, ref, reason) {
    const r = ctx.state.contactRetry || {};
    return r.refKey === refKey(ref) && r.reason === reason && r.at && ctx.now - new Date(r.at).getTime() < RETRY_WINDOW_MS;
  },

  /**
   * Only escalate when the driver clearly says the previous advice still failed for the same problem.
   * A new ask (customer phone, COD, another issue) with no order number must never reuse the old order (D26).
   */
  _retryFollowUp(ctx) {
    const r = ctx.state.contactRetry || {};
    if (!r.ref || !r.at || ctx.now - new Date(r.at).getTime() >= RETRY_WINDOW_MS) return null;
    if (!['deadBoxOnline', 'parcelFits'].includes(ctx.state.lastTemplate)) return null;
    if (ctx.refs.length && refKey(ctx.refs[0]) !== r.refKey) return null;
    const cls = ctx.cls || {};
    // Different intent → ask for the order number; do not notify about the previous one.
    if (cls.contactRequest || cls.customerNoAnswer || cls.codRequest || cls.offBox) return null;
    const expected = r.reason === 'parcel_fits' ? 'parcel_too_large' : 'code_not_working';
    if (cls.stuckIssue && cls.stuckIssue !== expected && cls.stuckIssue !== 'other') return null;
    const t = ctx.normalized || '';
    const stillStuck =
      /\b(still|again|same|abhi\s*bhi)\b/i.test(t) ||
      /\b(still\s+)?(won'?t|wont|doesn'?t|didn'?t|isn'?t|can'?t)\s+(fit|open|work|go(\s*in)?|go\s*into)\b/i.test(t) ||
      /\b(nahi|nhi|nai)\s*(chal|khul|ja|aa)\w*/i.test(t) ||
      /(ما زال|مازال|لسه|برضو|ما فتح|ما يفتح|ما دخل|ما يدخل|ما زالت|مازالت)/.test(t);
    if (!stillStuck) return null;
    return { ref: r.ref, issue: expected };
  },

  _markRetry(ctx, ref, reason) {
    ctx.updates.$set.contactRetry = { ref, refKey: refKey(ref), reason, at: new Date(ctx.now) };
  },

  // --- Cash on delivery: peek → driver-contact cod ------------------------------------------

  async _contactCod(ctx, ref, note) {
    const peek = await llboxService.peekReference(ref);
    if (peek.status === 404 || peek.status === 409) return this._lookup(ctx, ref);
    if (peek.status === 200 && peek.data?.payment_type === 'prepaid') {
      return { outcome: 'cod_prepaid', orderReference: ref, template: 'codPrepaid', reply: this._say(ctx, 'codPrepaid', { ref: peek.data.reference || ref }) };
    }
    const { status, data } = await this._driverContact(ctx, ref, 'cod', note);
    if (status === 200 && data.released && data.contact?.phone) {
      this._resetFailures(ctx);
      const amount = data.cod_amount ?? peek.data?.cod_amount;
      return this._released(ctx, ref, 'codReleased', data, (lang) => ({
        amount: amount != null ? (lang === 'ar' ? ` (${amount} ريال)` : ` (${amount} SAR)`) : '',
      }));
    }
    if (status === 403) return this._optedOut(ctx, ref);
    if (status === 409 && /prepaid|not_cod/.test(String(data.reason || data.code))) {
      return { outcome: 'cod_prepaid', orderReference: ref, template: 'codPrepaid', reply: this._say(ctx, 'codPrepaid', { ref }) };
    }
    if (status === 409 && /ambiguous/.test(String(data.reason || data.code))) return this._lookup(ctx, ref);
    if (status === 404) {
      this._countFailure(ctx);
      return { outcome: 'contact_not_available', orderReference: ref, template: 'noValidRef', reply: this._say(ctx, 'noValidRef') };
    }
    return this._notifyInstead(ctx, ref, 'other', `Driver needs to collect cash on delivery. ${note || ''}`);
  },

  // --- Box does not respond: driver-contact box_unresponsive ----------------------------------

  async _deadBox(ctx, ref, note, cls = {}) {
    const { status, data } = await this._driverContact(ctx, ref, 'box_unresponsive', note);
    if (status === 200 && data.released && data.contact?.phone) {
      this._resetFailures(ctx);
      return this._released(ctx, ref, 'deadBoxReleased', data);
    }
    if (status === 202) {
      if (data.request_id) {
        await followUpService
          .scheduleContactReview({
            phoneDigits: ctx.phoneDigits,
            ref,
            requestId: data.request_id,
            conversationId: this._conversationId(ctx),
            reason: 'box_unresponsive',
            languages: ctx.mode,
          })
          .catch((err) => logger.warn(`[contact] schedule review failed: ${err.message}`));
      }
      return { outcome: 'contact_pending_review', orderReference: ref, template: 'deadBoxPending', reply: this._say(ctx, 'deadBoxPending') };
    }
    if (status === 409 && /box_online/.test(String(data.reason || data.code))) {
      if (this._retriedRecently(ctx, ref, 'box_online')) {
        ctx.updates.$unset.contactRetry = 1;
        return this._stuckWithRef(ctx, ref, 'code_not_working', note, cls);
      }
      this._markRetry(ctx, ref, 'box_online');
      return { outcome: 'box_online_retry', orderReference: ref, template: 'deadBoxOnline', reply: this._say(ctx, 'deadBoxOnline') };
    }
    if (status === 403) return this._optedOut(ctx, ref);
    return this._stuckWithRef(ctx, ref, 'code_not_working', note, cls);
  },

  // --- Parcel too large: peek (max_parcel_cm) → driver-contact parcel_too_large ----------------

  _askSize(ctx, ref, note) {
    delete ctx.updates.$unset.pendingIssue;
    ctx.updates.$set.pendingIssue = { issue: 'parcel_too_large', note: String(note || '').slice(0, 500), ref, step: 'dims', at: new Date(ctx.now) };
    return { outcome: 'parcel_size_asked', orderReference: ref, template: 'parcelAskSize', reply: this._say(ctx, 'parcelAskSize') };
  },

  async _oversized(ctx, ref, note, dims, cls = {}) {
    if (!dims) {
      const peek = await llboxService.peekReference(ref);
      if (peek.status === 200 && peek.data?.max_parcel_cm) return this._askSize(ctx, ref, note);
    }
    const { status, data } = await this._driverContact(ctx, ref, 'parcel_too_large', note, dims || undefined);
    if (status === 200 && data.released && data.contact?.phone) {
      this._resetFailures(ctx);
      return this._released(ctx, ref, 'parcelReleased', data);
    }
    if (status === 422 && !dims) return this._askSize(ctx, ref, note);
    if (status === 409 && /parcel_fits/.test(String(data.reason || data.code))) {
      if (this._retriedRecently(ctx, ref, 'parcel_fits')) {
        ctx.updates.$unset.contactRetry = 1;
        return this._stuckWithRef(ctx, ref, 'parcel_too_large', note, cls);
      }
      this._markRetry(ctx, ref, 'parcel_fits');
      return { outcome: 'parcel_fits', orderReference: ref, template: 'parcelFits', reply: this._say(ctx, 'parcelFits') };
    }
    if (status === 403) return this._optedOut(ctx, ref);
    return this._stuckWithRef(ctx, ref, 'parcel_too_large', note, cls);
  },

  /** Rate-limited or unexpected: pass a message through notify-recipient instead of looping. */
  async _notifyInstead(ctx, ref, issue, note) {
    const journeyService = require('./journey.service');
    const notify = await journeyService.handleNotifyRecipient({ orderReference: ref, issue, note: String(note || '').slice(0, 500) });
    if (notify.notified) {
      return { outcome: 'contact_limited_notified', orderReference: ref, notified: true, template: 'contactLimitedNotified', reply: this._say(ctx, 'contactLimitedNotified', { ref }) };
    }
    return { outcome: 'contact_not_available', orderReference: ref, template: 'noValidRef', reply: this._say(ctx, 'noValidRef') };
  },
};

module.exports.conversationIdFor = conversationIdFor;
