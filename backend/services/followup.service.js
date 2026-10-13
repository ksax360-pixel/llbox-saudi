/**
 * Driver / owner follow-ups after the turn has ended (LLBox API is request/response only):
 *  - delivery_status: poll delivery/status after a handover, thank the driver when completed.
 *  - contact_review: poll driver-contact/:id after a 202 pending_review.
 *  - cancelled_arrival: poll cancelled-arrival/:id; tell the driver when approved / declined / timed out.
 *  - arrival_ask: message the owner on WhatsApp about a cancelled arrival (from arrival-requests/open).
 * Released phone numbers are sent once in a WhatsApp message and never stored on the job.
 */

const FollowUpJob = require('../models/FollowUpJob');
const llboxService = require('./llbox.service');
const journeyService = require('./journey.service');
const whatsappService = require('./whatsapp.service');
const logger = require('../config/logger');
const { one, DIVIDER } = require('./templates.service');
const { refKey } = require('./inbound.service');
const { digitsOnly } = require('../utils/phone');

const TICK_MS = 20 * 1000;
const STATUS_FIRST_MS = 3 * 60 * 1000;
const STATUS_EVERY_MS = 3 * 60 * 1000;
const STATUS_SLOW_MS = 10 * 60 * 1000;
const STATUS_WINDOW_MS = 6 * 60 * 60 * 1000;
const REVIEW_EVERY_MS = 30 * 1000;
const REVIEW_WINDOW_MS = 30 * 60 * 1000;
const ARRIVAL_EVERY_MS = 15 * 1000;
const ARRIVAL_DEFAULT_WAIT_MS = 5 * 60 * 1000;
const OPEN_SWEEP_MS = 20 * 1000;
const LOCK_MS = 2 * 60 * 1000;

const compose = (languages, parts) =>
  (languages && languages.length ? languages : ['en'])
    .map((lang) => parts(lang).filter(Boolean).join('\n\n'))
    .join(DIVIDER);

class FollowUpService {
  start() {
    if (this.timer || process.env.FOLLOWUPS_DISABLED === 'true') return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => logger.warn(`[followup] tick failed: ${err.message}`));
    }, TICK_MS);
    if (this.timer.unref) this.timer.unref();
    logger.info('[followup] worker started');
  }

  async scheduleDeliveryStatus({ phoneDigits, ref, languages }) {
    const now = Date.now();
    await FollowUpJob.findOneAndUpdate(
      { type: 'delivery_status', phoneDigits, refKey: refKey(ref) },
      {
        $set: {
          ref,
          languages,
          status: 'active',
          nextAt: new Date(now + STATUS_FIRST_MS),
          until: new Date(now + STATUS_WINDOW_MS),
          attempts: 0,
          lockedAt: null,
          result: '',
        },
      },
      { upsert: true }
    );
  }

  async scheduleContactReview({ phoneDigits, ref, requestId, conversationId, reason, languages }) {
    const now = Date.now();
    await FollowUpJob.findOneAndUpdate(
      { type: 'contact_review', phoneDigits, refKey: refKey(ref) },
      {
        $set: {
          ref,
          requestId: String(requestId),
          conversationId,
          reason,
          languages,
          status: 'active',
          nextAt: new Date(now + REVIEW_EVERY_MS),
          until: new Date(now + REVIEW_WINDOW_MS),
          attempts: 0,
          lockedAt: null,
          result: '',
        },
      },
      { upsert: true }
    );
  }

  async scheduleCancelledArrival({ phoneDigits, ref, requestId, conversationId, languages, waitSeconds }) {
    const now = Date.now();
    const waitMs = Math.max(60, Number(waitSeconds) || 300) * 1000 + 30 * 1000;
    await FollowUpJob.findOneAndUpdate(
      { type: 'cancelled_arrival', phoneDigits, refKey: refKey(ref) },
      {
        $set: {
          ref,
          requestId: String(requestId),
          conversationId,
          languages,
          status: 'active',
          nextAt: new Date(now + ARRIVAL_EVERY_MS),
          until: new Date(now + waitMs),
          attempts: 0,
          lockedAt: null,
          result: '',
        },
      },
      { upsert: true }
    );
  }

  async tick() {
    await this._sweepOpenArrivals().catch((err) => logger.warn(`[followup] open arrivals: ${err.message}`));
    for (let i = 0; i < 20; i += 1) {
      const now = new Date();
      const job = await FollowUpJob.findOneAndUpdate(
        {
          status: 'active',
          nextAt: { $lte: now },
          $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now.getTime() - LOCK_MS) } }],
        },
        { $set: { lockedAt: now }, $inc: { attempts: 1 } },
        { new: true, sort: { nextAt: 1 } }
      );
      if (!job) return;
      try {
        if (job.type === 'delivery_status') await this._deliveryStatus(job);
        else if (job.type === 'contact_review') await this._contactReview(job);
        else if (job.type === 'cancelled_arrival') await this._cancelledArrival(job);
        else if (job.type === 'arrival_ask') await this._arrivalAsk(job);
        else await this._finish(job, 'done', `unknown type ${job.type}`);
      } catch (err) {
        logger.warn(`[followup] ${job.type} ${job.ref} failed: ${err.message}`);
        await this._reschedule(job, 60 * 1000);
      }
    }
  }

  async _finish(job, status, result) {
    await FollowUpJob.updateOne({ _id: job._id }, { $set: { status, result, lockedAt: null } });
    logger.info(`[followup] ${job.type} ${job.ref} → ${status} (${result})`);
  }

  async _reschedule(job, inMs) {
    await FollowUpJob.updateOne({ _id: job._id }, { $set: { nextAt: new Date(Date.now() + inMs), lockedAt: null } });
  }

  async _send(job, text) {
    await whatsappService.sendText(job.phoneDigits, text);
  }

  async _deliveryStatus(job) {
    if (Date.now() > job.until.getTime()) return this._finish(job, 'expired', 'window ended');
    const { status, data } = await llboxService.deliveryStatus(job.ref);
    if (status === 200 && data?.completed) {
      await this._send(job, compose(job.languages, (lang) => [one('driverThanks', lang, { ref: job.ref })]));
      return this._finish(job, 'done', 'completed, driver thanked');
    }
    if (status === 200 && ['cancelled', 'expired'].includes(String(data?.status))) {
      return this._finish(job, 'done', String(data.status));
    }
    if (status === 404) return this._finish(job, 'done', 'not found');
    if (status === 429) return this._reschedule(job, 5 * 60 * 1000);
    return this._reschedule(job, job.attempts > 20 ? STATUS_SLOW_MS : STATUS_EVERY_MS);
  }

  async _contactReview(job) {
    const langs = job.languages;
    if (Date.now() > job.until.getTime()) {
      const notify = await journeyService.handleNotifyRecipient({
        orderReference: job.ref,
        issue: 'code_not_working',
        note: 'Driver reported the box is not responding; box check still pending.',
      });
      await this._send(job, compose(langs, (lang) => [
        notify.notified ? one('deadBoxTimeout', lang, { ref: job.ref }) : one('notifyError', lang),
      ]));
      return this._finish(job, 'expired', `review timeout, notified=${Boolean(notify.notified)}`);
    }

    const { status, data } = await llboxService.driverContactStatus(job.requestId, job.conversationId);
    const state = String(data?.status || data?.reason || '').toLowerCase();
    if (status === 200 && data?.released && data?.contact?.phone) {
      await this._send(job, compose(langs, (lang) => [
        one('deadBoxReleased', lang, { name: data.recipient_first_name || '', phone: data.contact.phone }),
        data.customer_notified ? one('contactNotified', lang) : '',
        one('contactOneOff', lang),
      ]));
      return this._finish(job, 'done', 'released');
    }
    if (status === 200 && /pending/.test(state)) return this._reschedule(job, REVIEW_EVERY_MS);
    if (status === 200 && /opted_out/.test(state)) {
      await this._send(job, compose(langs, (lang) => [one('contactOptedOut', lang)]));
      return this._finish(job, 'done', 'opted out');
    }
    if (status === 200 && state) {
      await this._send(job, compose(langs, (lang) => [one('deadBoxDenied', lang, { ref: job.ref })]));
      return this._finish(job, 'done', `refused: ${state}`);
    }
    if (status === 404) return this._finish(job, 'done', 'request not found');
    return this._reschedule(job, REVIEW_EVERY_MS);
  }

  /** Pull open cancelled-arrival questions and queue an owner WhatsApp ask for each. */
  async _sweepOpenArrivals() {
    if (this._lastOpenSweep && Date.now() - this._lastOpenSweep < OPEN_SWEEP_MS) return;
    this._lastOpenSweep = Date.now();
    const { status, data } = await llboxService.arrivalRequestsOpen();
    if (status !== 200) return;
    const requests = data?.requests || data?.open || [];
    for (const req of requests) {
      const requestId = String(req.request_id || req.id || '');
      const phone = digitsOnly(req.whatsapp_phone || req.phone || '');
      const ref = req.reference || req.order_reference || '';
      if (!requestId || !phone || !ref) continue;
      const existing = await FollowUpJob.findOne({ type: 'arrival_ask', requestId });
      if (existing) continue;
      const waitMs = Math.max(60, Number(req.seconds_left || req.wait_seconds) || 300) * 1000 + 60 * 1000;
      const now = Date.now();
      await FollowUpJob.create({
        type: 'arrival_ask',
        phoneDigits: phone,
        ref,
        refKey: refKey(ref),
        requestId,
        languages: ['en', 'ar'],
        ownerNotified: false,
        status: 'active',
        nextAt: new Date(now),
        until: new Date(now + waitMs),
        attempts: 0,
      });
    }
  }

  async _arrivalAsk(job) {
    if (Date.now() > job.until.getTime()) return this._finish(job, 'expired', 'owner ask window ended');
    if (!job.ownerNotified) {
      await this._send(job, compose(job.languages, (lang) => [one('cancelledArrivalOwnerAsk', lang, { ref: job.ref })]));
      await FollowUpJob.updateOne({ _id: job._id }, { $set: { ownerNotified: true, lockedAt: null, nextAt: new Date(Date.now() + ARRIVAL_EVERY_MS) } });
      logger.info(`[followup] arrival_ask messaged owner for ${job.ref} request=${job.requestId}`);
      return;
    }
    // Owner may answer in the app; once the request is no longer open for them, we are done.
    const { status, data } = await llboxService.arrivalRequestsFor(`+${job.phoneDigits}`);
    const open = status === 200 ? data?.requests || data?.open || [] : [];
    const stillOpen = open.some((r) => String(r.request_id || r.id) === String(job.requestId));
    if (!stillOpen) return this._finish(job, 'done', 'owner answered or request closed');
    return this._reschedule(job, ARRIVAL_EVERY_MS);
  }

  async _cancelledArrival(job) {
    const langs = job.languages;
    const { status, data } = await llboxService.cancelledArrivalStatus(job.requestId, job.conversationId);
    const state = String(data?.status || data?.reason || '').toLowerCase();
    logger.info(`[followup] cancelled_arrival ${job.ref} http=${status} state=${state || '-'} released=${Boolean(data?.released)}`);

    if (status === 200 && /approved/.test(state)) {
      await this._send(job, compose(langs, (lang) => [one('cancelledArrivalApproved', lang, { ref: job.ref })]));
      return this._finish(job, 'done', 'approved');
    }
    if (status === 200 && /declined|denied|rejected/.test(state)) {
      await this._send(job, compose(langs, (lang) => [one('cancelledArrivalDeclined', lang, { ref: job.ref })]));
      return this._finish(job, 'done', 'declined');
    }
    if (status === 200 && (/no_response|timeout|expired/.test(state) || data?.released === true || data?.released === false)) {
      if (data?.released && data?.contact?.phone) {
        await this._send(job, compose(langs, (lang) => [
          one('cancelledArrivalReleased', lang, {
            name: data.recipient_first_name || data.contact?.name || '',
            phone: data.contact.phone,
          }),
        ]));
        return this._finish(job, 'done', 'no_response released');
      }
      if (/no_response|timeout|expired/.test(state) || data?.released === false) {
        await this._send(job, compose(langs, (lang) => [one('cancelledArrivalSilent', lang, { ref: job.ref })]));
        return this._finish(job, 'done', 'no_response silent');
      }
    }
    if (status === 200 && /waiting|pending/.test(state)) {
      if (Date.now() > job.until.getTime()) {
        // One last poll after the window; if still waiting, treat as silent.
        await this._send(job, compose(langs, (lang) => [one('cancelledArrivalSilent', lang, { ref: job.ref })]));
        return this._finish(job, 'expired', 'wait ended still waiting');
      }
      return this._reschedule(job, ARRIVAL_EVERY_MS);
    }
    if (status === 404) return this._finish(job, 'done', 'request not found');
    if (Date.now() > job.until.getTime()) {
      await this._send(job, compose(langs, (lang) => [one('cancelledArrivalSilent', lang, { ref: job.ref })]));
      return this._finish(job, 'expired', 'wait ended');
    }
    return this._reschedule(job, ARRIVAL_EVERY_MS);
  }
}

module.exports = new FollowUpService();
