/**
 * Box owner / member mode (Conversation Reference pp. 14–17; Test Report 2026-10-04 Part B, F1–F19).
 * Intent first, reference second. Conversation state lives in TurnState.ownerSlot and expires;
 * an old reference is only reused when the slot is waiting for exactly that answer, and is echoed.
 * Mixed into TurnService (uses this._say / this._compose and the turn ctx).
 */

const llboxService = require('./llbox.service');
const journeyService = require('./journey.service');
const logger = require('../config/logger');
const { one } = require('./templates.service');
const { refKey, parseDeliveryDay, classifyOwnerIntent } = require('./inbound.service');
const { dayLabel, formatDay, weekdayName, timeLabel, riyadhTodayIso } = require('./day-format');

const SLOT_TTL_MS = 15 * 60 * 1000;
const TICKET_DEDUPE_MS = 10 * 60 * 1000;
const MAX_REFS = 5;

const MENU_FROM_ACTION = {
  register_delivery: 'register',
  list_deliveries: 'list',
  cancel_delivery: 'cancel',
  get_code: 'code',
  box_status: 'status',
};
const MENU_INTENT = {
  register: 'register',
  list: 'list',
  cancel: 'cancel',
  code: 'guestCode',
  status: 'boxStatus',
  boxNumber: 'boxNumber',
  report: 'reportIssue',
};
const ANGRY = /\b(useless|terrible|worst|stupid|angry|ridiculous|rubbish|hate|wtf|nonsense|scam|fed\s*up)\b|(زفت|سيء|سيئ|خايس|مزعج|تعبتوني)/i;
const STATUS_WORD = {
  en: { pending: 'waiting for a driver', matched: 'with a driver', completed: 'already delivered', cancelled: 'cancelled', expired: 'expired' },
  ar: { pending: 'بانتظار السائق', matched: 'مع السائق', completed: 'تم تسليمه', cancelled: 'ملغى', expired: 'منتهي' },
};

const ok2xx = (status) => status >= 200 && status < 300;
const firstName = (name = '') => String(name || '').trim().split(/\s+/)[0] || '';
const amountText = (amount, lang) => (amount == null ? '' : lang === 'ar' ? ` (${amount} ريال)` : ` (${amount} SAR)`);

/** COD amount: a number next to cod/cash/SAR, never a reference or a day. */
const amountFrom = (text = '') => {
  const s = String(text || '');
  const m =
    s.match(/(?:\bcod\b|\bcash\b|\bsar\b|\bsr\b|riyals?|ريال|كاش|المبلغ)\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{1,2})?)(?!\d)/i) ||
    s.match(/(?<![\w-])(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:sar|sr|riyals?|ريال|ر\.س)/i);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};

const optionFrom = (d) => ({
  id: d.delivery_id,
  ref: d.reference,
  date: d.expected_delivery_date || '',
  status: d.status,
  boxId: d.box_id,
  boxCode: d.box_code,
  canCancel: Boolean(d.can_cancel),
});

const sortDeliveries = (list = []) =>
  [...list].sort((a, b) => {
    const rank = (d) => (d.status === 'matched' ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return String(a.expected_delivery_date || '9999').localeCompare(String(b.expected_delivery_date || '9999'));
  });

module.exports = {
  // ---------------------------------------------------------------------------
  // Entry
  // ---------------------------------------------------------------------------

  async _ownerTurn(ctx) {
    const own = classifyOwnerIntent(ctx.normalized);
    ctx.own = own;

    if (ctx.isMedia && ctx.mediaFailed) {
      return { outcome: 'photo_unreadable', template: 'photoUnreadable', reply: this._say(ctx, 'photoUnreadable') };
    }
    if (ctx.isMedia && !ctx.refs.length) {
      return { outcome: 'photo_no_reference', template: 'customerPhotoNoRef', reply: this._say(ctx, 'customerPhotoNoRef') };
    }
    if (ctx.inputType === 'sticker') {
      return this._ownerGreeting(ctx, { menuOnly: true, leadKey: 'ownerNotUnderstood', outcome: 'sticker' });
    }

    // A recognised owner never leaves owner mode (acceptance O23).
    if (own.flags.selfDriver) {
      return this._out(ctx, 'owner_never_driver', 'ownerNeverDriver');
    }
    if (own.intent === 'manipulation' || own.flags.manipulation) {
      return this._out(ctx, 'manipulation_refused', 'ownerManipulation');
    }

    const slot = this._freshSlot(ctx);
    // Cancelled-arrival YES/NO only when we are not already waiting for a slot yes/no (cancel confirm, etc.).
    if (!slot || !['confirm', 'listed', 'cod', 'pick', 'menu', 'offerRegister'].includes(slot.step)) {
      const arrivalAnswer = await this._ownerArrivalAnswer(ctx, own);
      if (arrivalAnswer) return arrivalAnswer;
    }
    if (slot) {
      const answered = await this._ownerSlotAnswer(ctx, slot, own);
      if (answered) return answered;
      this._clearSlot(ctx);
    }

    let { intent } = own;
    if (!intent) {
      if (own.flags.digit) intent = this._menuIntent(ctx, Number(own.flags.digit)) || 'menu';
      else if (ctx.refs.length) intent = 'register';
      else if (own.flags.yes) intent = 'menu';
    }
    return this._ownerIntent(ctx, intent);
  },

  async _ownerIntent(ctx, intent) {
    switch (intent) {
      case 'manipulation':
        return this._out(ctx, 'manipulation_refused', 'ownerManipulation');
      case 'optOut':
      case 'optIn':
      case 'driverContactOff':
      case 'driverContactOn':
        return this._ownerPrefs(ctx, intent);
      case 'accountChange':
        return this._ownerAccountChange(ctx);
      case 'reportIssue':
        return this._ownerReport(ctx);
      case 'replaceCode':
        return this._ownerReplaceCode(ctx);
      case 'cancel':
        return this._ownerCancel(ctx);
      case 'guestCode':
        return this._ownerGuestCode(ctx);
      case 'boxNumber':
        return this._ownerBoxNumber(ctx);
      case 'boxStatus':
        return this._ownerBoxStatus(ctx);
      case 'list':
        return this._ownerList(ctx);
      case 'register':
        return this._ownerRegisterStart(ctx);
      case 'support':
        return this._ownerSupport(ctx);
      case 'human': {
        const support = await llboxService.supportContact();
        return {
          outcome: 'human_request',
          template: 'ownerHuman',
          reply: this._compose(ctx, (lang) => [one('ownerHuman', lang), this._supportText(support, lang)]),
        };
      }
      case 'info':
        return { outcome: 'product_info', template: 'ownerProductInfo', reply: this._say(ctx, 'ownerProductInfo') };
      case 'thanks':
        return { outcome: 'thanks', template: 'ownerThanks', reply: this._say(ctx, 'ownerThanks') };
      case 'menu':
        return this._ownerGreeting(ctx, { menuOnly: true });
      case 'greeting':
        return this._ownerGreeting(ctx);
      default:
        return this._ownerFallback(ctx);
    }
  },

  async _ownerFallback(ctx) {
    if (ctx.tooShort) return { outcome: 'too_short', template: 'tooShort', reply: this._say(ctx, 'tooShort') };
    if (ctx.junk) {
      this._setSlot(ctx, { intent: 'register', step: 'ref' });
      return this._out(ctx, 'not_a_reference', 'ownerNotARef');
    }
    const day = parseDeliveryDay(ctx.normalized, ctx.now);
    if (day.date && !day.issue) {
      this._setSlot(ctx, { intent: 'register', step: 'ref', date: day.date });
      return this._out(ctx, 'register_ask_ref', 'ownerAskRef');
    }
    if (ANGRY.test(ctx.normalized)) {
      return this._ownerGreeting(ctx, { menuOnly: true, leadKey: 'ownerSorry', outcome: 'owner_upset' });
    }
    return this._ownerGreeting(ctx, { menuOnly: true, leadKey: 'ownerNotUnderstood', outcome: 'owner_not_understood' });
  },

  // ---------------------------------------------------------------------------
  // Slot (conversation state with expiry)
  // ---------------------------------------------------------------------------

  _freshSlot(ctx) {
    const slot = ctx.state.ownerSlot;
    if (!slot || !slot.at) return null;
    if (ctx.now - new Date(slot.at).getTime() > SLOT_TTL_MS) {
      ctx.updates.$unset.ownerSlot = 1;
      return null;
    }
    return slot;
  },

  _setSlot(ctx, slot) {
    delete ctx.updates.$unset.ownerSlot;
    ctx.updates.$set.ownerSlot = { ...slot, at: new Date(ctx.now) };
  },

  _clearSlot(ctx) {
    delete ctx.updates.$set.ownerSlot;
    if (ctx.state.ownerSlot) ctx.updates.$unset.ownerSlot = 1;
  },

  async _ownerSlotAnswer(ctx, slot, own) {
    const { intent: newIntent, flags } = own;
    const explicit = Boolean(newIntent) && !['thanks', 'greeting'].includes(newIntent);
    const mentioned = (list) => (list || []).filter((r) => ctx.refs.some((x) => refKey(x) === refKey(r)));

    switch (slot.step) {
      case 'box': {
        const box = this._matchBox(ctx, { allowDigit: true });
        if (box) return this._resumeWithBox(ctx, slot, box.boxId);
        if (explicit || ctx.refs.length) return null;
        return this._askBox(ctx, slot);
      }
      case 'day': {
        if (ctx.refs.length && !mentioned(slot.refs).length) return null;
        const day = parseDeliveryDay(ctx.normalized, ctx.now);
        if (day.date || flags.notSure) {
          return this._ownerRegisterStart(ctx, {
            refs: slot.refs,
            boxId: slot.boxId,
            dayInfo: day,
            payment: slot.payment || this._paymentFrom(ctx),
            dayAsked: true,
            dropped: slot.dropped || 0,
          });
        }
        if (explicit) return null;
        const payment = this._paymentFrom(ctx);
        if (payment && !slot.payment) {
          this._setSlot(ctx, { ...slot, payment });
          return this._out(ctx, 'register_ask_day', 'ownerAskDayAgain', { ref: slot.refs.join(', ') });
        }
        if (!slot.reasked) {
          this._setSlot(ctx, { ...slot, reasked: true });
          return this._out(ctx, 'register_ask_day', 'ownerAskDayAgain', { ref: slot.refs.join(', ') });
        }
        return null;
      }
      case 'cod': {
        if (ctx.refs.length && !mentioned(slot.refs).length) return null;
        const all = /\b(both|all|each|every|dono|sab)\b|(كلها|كلهم|الاثنين|الإثنين|جميعها)/i.test(ctx.normalized);
        const refs = mentioned(slot.refs).length ? mentioned(slot.refs) : slot.refs.length === 1 || all ? slot.refs : [];
        let payment = null;
        if (flags.cod || (flags.yes && !explicit)) payment = { type: 'cod', amount: amountFrom(ctx.normalized) };
        else if (flags.prepaid || flags.no) payment = { type: 'prepaid' };
        else if (/^\s*\d{1,6}([.,]\d{1,2})?\s*(sar|sr|riyals?|ريال)?\s*$/i.test(ctx.normalized)) {
          payment = { type: 'cod', amount: Number(ctx.normalized.replace(/[^\d.,]/g, '').replace(',', '.')) };
        } else if (flags.notSure) {
          this._clearSlot(ctx);
          return this._out(ctx, 'payment_unknown', 'ownerCodSkipped');
        }
        if (!payment) return null;
        if (!refs.length) {
          this._setSlot(ctx, slot);
          return this._out(ctx, 'payment_which', 'ownerCodWhich');
        }
        return this._ownerSetPayment(ctx, refs, payment, slot);
      }
      case 'ref': {
        if (ctx.refs.length) {
          return this._ownerRegisterStart(ctx, slot.date ? { refs: ctx.refs, dayInfo: { date: slot.date, issue: '' } } : { refs: ctx.refs });
        }
        if (explicit) return null;
        if (flags.no) {
          this._clearSlot(ctx);
          return this._out(ctx, 'owner_ok', 'ownerOk');
        }
        if (ctx.junk) {
          this._setSlot(ctx, slot);
          return this._out(ctx, 'not_a_reference', 'ownerNotARef');
        }
        if (ctx.tooShort) {
          this._setSlot(ctx, slot);
          return { outcome: 'too_short', template: 'tooShort', reply: this._say(ctx, 'tooShort') };
        }
        return null;
      }
      case 'offerRegister': {
        if (flags.yes && !explicit) {
          return slot.refs && slot.refs.length
            ? this._ownerRegisterStart(ctx, { refs: slot.refs })
            : this._ownerRegisterStart(ctx, { refs: [] });
        }
        if (flags.no && !explicit) {
          this._clearSlot(ctx);
          return this._out(ctx, 'owner_ok', 'ownerOk');
        }
        return null;
      }
      case 'listed': {
        if ((flags.yes && !explicit) || (newIntent === 'cancel' && !ctx.refs.length)) {
          return this._ownerCancelPick(ctx, slot.options || []);
        }
        if (flags.no && !explicit) {
          this._clearSlot(ctx);
          return this._out(ctx, 'owner_ok', 'ownerOk');
        }
        return null;
      }
      case 'pick': {
        if (slot.intent === 'replaceCode' && flags.guest) return this._ownerGuestCode(ctx);
        const opt = this._pickOption(ctx, slot.options || []);
        if (opt) return slot.intent === 'cancel' ? this._ownerCancelConfirm(ctx, [opt]) : this._ownerIssueReplacement(ctx, opt);
        if (ctx.refs.length) return slot.intent === 'cancel' ? this._ownerCancel(ctx) : this._ownerReplaceCode(ctx);
        if (flags.no && !explicit) {
          this._clearSlot(ctx);
          return this._out(ctx, 'owner_ok', 'ownerOk');
        }
        return null;
      }
      case 'confirm': {
        if (flags.yes && !explicit) return this._ownerDoCancel(ctx, slot.options || []);
        if (flags.no && !explicit) {
          this._clearSlot(ctx);
          return this._out(ctx, 'cancel_kept', 'ownerCancelKept', { ref: (slot.options || []).map((o) => o.ref).join(', ') });
        }
        return null;
      }
      case 'describe': {
        if (explicit && newIntent !== 'reportIssue') return null;
        const words = ctx.normalized.split(/\s+/).filter(Boolean).length;
        if (words >= 2 || flags.issueCategory) {
          return this._ownerReport(ctx, { description: ctx.raw, boxId: slot.boxId });
        }
        return null;
      }
      case 'menu': {
        if (flags.digit) {
          const intent = this._menuIntent(ctx, Number(flags.digit));
          if (intent) {
            this._clearSlot(ctx);
            return this._ownerIntent(ctx, intent);
          }
        }
        if (flags.yes && !explicit) return this._ownerGreeting(ctx, { menuOnly: true });
        return null;
      }
      default:
        return null;
    }
  },

  _pickOption(ctx, options) {
    const digit = Number(ctx.own.flags.digit || 0);
    if (digit && options[digit - 1]) return options[digit - 1];
    if (ctx.refs.length) return options.find((o) => refKey(o.ref) === refKey(ctx.refs[0])) || null;
    return null;
  },

  // ---------------------------------------------------------------------------
  // Boxes
  // ---------------------------------------------------------------------------

  _boxes(ctx) {
    return Array.isArray(ctx.identity.boxes) ? ctx.identity.boxes : [];
  },

  _hasBox(ctx) {
    return this._boxes(ctx).length > 0;
  },

  _boxLabel(box) {
    return box ? box.nickname || box.boxCode || box.box_code || '' : '';
  },

  _ownerNoBox(ctx) {
    this._clearSlot(ctx);
    return this._out(ctx, 'owner_no_box', 'ownerNoBox');
  },

  _matchBox(ctx, { allowDigit = false } = {}) {
    const boxes = this._boxes(ctx);
    const t = ctx.normalized.toLowerCase();
    const digit = Number(ctx.own.flags.digit || 0);
    if (allowDigit && digit && boxes[digit - 1]) return boxes[digit - 1];
    const compact = refKey(t);
    const byCode = boxes.filter((b) => b.boxCode && compact.includes(refKey(b.boxCode)));
    if (byCode.length === 1) return byCode[0];
    const SYN = [
      [/\b(home|house|villa)\b|منزل|البيت|بيت/, /home|house|villa|منزل|بيت/i],
      [/\b(office|work)\b|مكتب|الدوام/, /office|work|مكتب/i],
    ];
    const byName = boxes.filter((b) => {
      const nick = String(b.nickname || '').toLowerCase();
      if (!nick) return false;
      const words = nick.split(/[\s,،\-/]+/).filter((w) => w.length >= 4 && !/^\d+$/.test(w));
      if (words.some((w) => t.includes(w))) return true;
      return SYN.some(([said, inNick]) => said.test(t) && inNick.test(nick));
    });
    return byName.length === 1 ? byName[0] : null;
  },

  _askBox(ctx, slot) {
    const boxes = this._boxes(ctx);
    const options = boxes
      .map((b, i) => `${i + 1}. ${b.nickname ? `${b.nickname} (${b.boxCode})` : b.boxCode}`)
      .join('\n');
    this._setSlot(ctx, { ...slot, step: 'box' });
    return this._out(ctx, 'ask_box', 'ownerWhichBox', { options });
  },

  /** { boxId } when known, or { ask } with the which-box question already set up. */
  _needBox(ctx, slot) {
    const boxes = this._boxes(ctx);
    if (boxes.length <= 1) return { boxId: boxes[0]?.boxId };
    const match = this._matchBox(ctx);
    if (match) return { boxId: match.boxId };
    return { ask: this._askBox(ctx, slot) };
  },

  _resumeWithBox(ctx, slot, boxId) {
    switch (slot.intent) {
      case 'register':
        return this._ownerRegisterStart(ctx, {
          refs: slot.refs || [],
          boxId,
          dayInfo: slot.dayInfo,
          payment: slot.payment || null,
          dayAsked: slot.dayAsked,
        });
      case 'guestCode':
        return this._ownerGuestCode(ctx, { boxId });
      case 'report':
        return this._ownerReport(ctx, { category: slot.category, description: slot.description, boxId });
      default:
        this._clearSlot(ctx);
        return this._ownerGreeting(ctx, { menuOnly: true });
    }
  },

  // ---------------------------------------------------------------------------
  // Greeting / menu (F13, F18)
  // ---------------------------------------------------------------------------

  _menuKeys(ctx) {
    const actions = ctx.identity.availableActions || [];
    let keys = actions.map((a) => MENU_FROM_ACTION[a]).filter(Boolean);
    if (!keys.length && this._hasBox(ctx)) keys = ['register', 'list', 'code', 'status'];
    if (this._hasBox(ctx)) keys.push('boxNumber', 'report');
    return [...new Set(keys)];
  },

  _menuIntent(ctx, n) {
    const key = this._menuKeys(ctx)[n - 1];
    return key ? MENU_INTENT[key] : '';
  },

  _summary(ctx, lang) {
    const id = ctx.identity;
    if (lang === 'en') return id.summary || '';
    const n = Number(id.activeDeliveries || 0);
    const count = n === 1 ? 'طلب نشط واحد' : n === 2 ? 'طلبان نشطان' : n <= 10 ? `${n} طلبات نشطة` : `${n} طلبًا نشطًا`;
    if (n > 0) return `لديك ${count}${id.parcelAwaitingCollection ? '، وطرد بانتظار الاستلام في الصندوق' : ''}.`;
    return id.parcelAwaitingCollection ? 'لديك طرد بانتظار الاستلام في الصندوق.' : '';
  },

  _ownerGreeting(ctx, { menuOnly = false, leadKey = '', outcome } = {}) {
    const id = ctx.identity;
    const name = firstName(id.recipientName);
    const hello = (lang) => one('ownerHello', lang, { name: name ? ` ${name}` : '' });
    if (!this._hasBox(ctx)) {
      this._clearSlot(ctx);
      return {
        outcome: outcome || 'owner_no_box',
        template: 'ownerNoBox',
        reply: this._compose(ctx, (lang) => [leadKey ? one(leadKey, lang) : hello(lang), one('ownerNoBox', lang)]),
      };
    }
    const nothing = !menuOnly && Number(id.activeDeliveries || 0) === 0 && !id.parcelAwaitingCollection && !id.fromState;
    if (nothing) {
      this._setSlot(ctx, { intent: 'register', step: 'offerRegister' });
      return {
        outcome: outcome || 'owner_greeting',
        template: 'ownerNothingOnWay',
        reply: this._compose(ctx, (lang) => [`${hello(lang)}\n${one('ownerNothingOnWay', lang)}`]),
      };
    }
    const keys = this._menuKeys(ctx);
    this._setSlot(ctx, { intent: 'menu', step: 'menu' });
    return {
      outcome: outcome || (menuOnly ? 'owner_menu' : 'owner_greeting'),
      template: menuOnly ? 'ownerMenu' : 'ownerGreeting',
      reply: this._compose(ctx, (lang) => {
        const head = leadKey ? one(leadKey, lang) : menuOnly ? '' : [hello(lang), this._summary(ctx, lang)].filter(Boolean).join('\n');
        const menu = [one('ownerMenuIntro', lang), ...keys.map((k, i) => `${i + 1}. ${one(`menu_${k}`, lang)}`)].join('\n');
        return [head, menu, one('ownerMenuAsk', lang)];
      }),
    };
  },

  // ---------------------------------------------------------------------------
  // Register (F2, F10, F11, F12, F17, F19 + COD question)
  // ---------------------------------------------------------------------------

  _paymentFrom(ctx) {
    const { flags } = ctx.own || {};
    if (!flags) return null;
    if (flags.cod) return { type: 'cod', amount: amountFrom(ctx.normalized) };
    if (flags.prepaid) return { type: 'prepaid' };
    return null;
  },

  async _ownerRegisterStart(ctx, opts = {}) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    const allRefs = opts.refs || ctx.refs || [];
    const refs = allRefs.slice(0, MAX_REFS);
    const dropped = opts.dropped != null ? Number(opts.dropped) || 0 : Math.max(0, allRefs.length - MAX_REFS);
    if (!refs.length) {
      const d = parseDeliveryDay(ctx.normalized, ctx.now);
      this._setSlot(ctx, { intent: 'register', step: 'ref', date: d.date && !d.issue ? d.date : '' });
      if (ctx.junk) return this._out(ctx, 'not_a_reference', 'ownerNotARef');
      if (ctx.tooShort) return { outcome: 'too_short', template: 'tooShort', reply: this._say(ctx, 'tooShort') };
      return this._out(ctx, 'register_ask_ref', 'ownerAskRef');
    }
    const dayInfo = opts.dayInfo || parseDeliveryDay(ctx.normalized, ctx.now);
    const payment = opts.payment !== undefined ? opts.payment : this._paymentFrom(ctx);
    const base = { intent: 'register', refs, payment };
    const refList = refs.join(', ');

    if (dayInfo.issue) {
      this._setSlot(ctx, { ...base, step: 'day', boxId: opts.boxId, dayAsked: true });
      const key = dayInfo.issue === 'past' ? 'ownerDayPast' : 'ownerDayTooFar';
      return this._out(ctx, `register_day_${dayInfo.issue}`, key, (lang) => ({ dayName: dayLabel(dayInfo.date, lang), ref: refList }));
    }

    let { boxId } = opts;
    if (!boxId) {
      const pick = this._needBox(ctx, { ...base, dayInfo, dayAsked: opts.dayAsked });
      if (pick.ask) return pick.ask;
      boxId = pick.boxId;
    }

    if (!dayInfo.date && !ctx.own.flags.notSure && !opts.dayAsked) {
      this._setSlot(ctx, { ...base, step: 'day', boxId, dropped });
      return {
        outcome: 'register_ask_day',
        template: 'ownerAskDay',
        reply: this._compose(ctx, (lang) => [
          one('ownerAskDay', lang, { ref: refList }),
          dropped > 0 ? one('ownerRefsLimit', lang, { n: MAX_REFS }) : '',
        ]),
      };
    }
    return this._ownerRegister(ctx, refs, { boxId, dayInfo, payment, dropped });
  },

  async _registerOne(ctx, ref, { boxId, date, payment }) {
    return journeyService.handleWhatsappRegistration({
      whatsappPhone: ctx.phoneE164,
      orderReference: ref,
      intent: 'register_delivery',
      identity: ctx.identity,
      boxId,
      ...(date ? { expectedDeliveryDate: date } : {}),
      ...(payment ? { paymentType: payment.type, ...(payment.amount != null ? { codAmount: payment.amount } : {}) } : {}),
    });
  },

  async _ownerRegister(ctx, refs, { boxId, dayInfo, payment, dropped = 0 }) {
    const results = [];
    for (const ref of refs) {
      results.push({ ref, r: await this._registerOne(ctx, ref, { boxId, date: dayInfo.date, payment }) });
    }
    const okRefs = results.filter((x) => x.r.success).map((x) => x.ref);
    const dayFull = results.find((x) => ['box_capacity_exceeded', 'invalid_expected_date'].includes(x.r.outcome));
    if (!okRefs.length && results.some((x) => x.r.outcome === 'choose_box')) {
      return this._askBox(ctx, { intent: 'register', refs, dayInfo, payment, dropped });
    }
    const todayIso = riyadhTodayIso(ctx.now);
    const many = refs.length > 1;

    const reply = this._compose(ctx, (lang) => {
      const lines = [];
      for (const { ref, r } of results) {
        if (r.success) {
          lines.push(one(many ? 'ownerRegisteredLine' : 'customerRegistered', lang, { ref, day: formatDay(r.expectedDeliveryDate, lang) }));
          if (dayInfo.weekdayToday && r.expectedDeliveryDate === todayIso) {
            lines.push(one('registeredTodayNote', lang, { weekday: weekdayName(dayInfo.weekday, lang) }));
          }
          if (r.warning) lines.push(this._tightLine(r, lang));
          if (payment?.type === 'cod') lines.push(one('ownerCodSaved', lang, { ref, amount: amountText(payment.amount, lang) }));
          if (payment?.type === 'prepaid') lines.push(one('ownerPrepaidSaved', lang, { ref }));
        } else if (r.outcome !== 'box_capacity_exceeded') {
          lines.push(this._registerFailLine(r, ref, lang, many, dayInfo));
        }
      }
      const fullByDay = new Map();
      for (const { ref, r } of results.filter((x) => x.r.outcome === 'box_capacity_exceeded')) {
        const day = r.expectedDeliveryDate || dayInfo.date || '';
        if (!fullByDay.has(day)) fullByDay.set(day, { r, refs: [] });
        fullByDay.get(day).refs.push(ref);
      }
      for (const { r, refs: fullRefs } of fullByDay.values()) {
        lines.push(this._registerFailLine(r, fullRefs.join(', '), lang, many, dayInfo));
      }
      if (many && okRefs.length) lines.push(one('ownerRegisteredTrailer', lang));
      if (okRefs.length && !payment) lines.push(one(okRefs.length === 1 ? 'ownerCodAsk' : 'ownerCodAskMany', lang));
      if (dropped > 0) lines.push(one('ownerRefsLimit', lang, { n: MAX_REFS }));
      return lines;
    });

    if (dayFull) {
      const dayRefs = results.filter((x) => ['box_capacity_exceeded', 'invalid_expected_date'].includes(x.r.outcome)).map((x) => x.ref);
      this._setSlot(ctx, { intent: 'register', step: 'day', refs: dayRefs, boxId, payment, dayAsked: true });
    } else if (okRefs.length && !payment) {
      const firstOk = results.find((x) => x.r.success);
      this._setSlot(ctx, { intent: 'register', step: 'cod', refs: okRefs, boxId, date: firstOk.r.expectedDeliveryDate || dayInfo.date || '' });
    } else {
      this._clearSlot(ctx);
    }

    const outcome =
      okRefs.length === results.length ? 'registered' : okRefs.length ? 'registered_partly' : `register_${results[0].r.outcome || 'failed'}`;
    return {
      outcome,
      template: okRefs.length ? 'customerRegistered' : 'registerFailed',
      orderReference: refs[0],
      registered: okRefs,
      reply,
    };
  },

  _tightLine(r, lang) {
    const count = r.deliveriesThatDay;
    const dayName = dayLabel(r.expectedDeliveryDate, lang);
    if (!count) return one('ownerBoxTightGeneric', lang, { dayName });
    const holds = String(r.warning || '').match(/holds\s+(\d+)|comfortabl\w*\s+(?:holds?\s+|takes?\s+)?(\d+)/i);
    const n = holds ? holds[1] || holds[2] : '';
    return one('customerBoxTight', lang, { count, dayName, holds: n ? one('boxHolds', lang, { n }) : '' });
  },

  _registerFailLine(r, ref, lang, many, dayInfo) {
    const dayName = dayLabel(r.expectedDeliveryDate || dayInfo.date, lang);
    switch (r.outcome) {
      case 'box_capacity_exceeded':
        return one('customerDayFull', lang, { ref, dayName, limit: r.hardLimit || r.deliveriesThatDay || '' });
      case 'invalid_expected_date':
        return one('customerDayInvalid', lang, { ref });
      case 'already_active':
        return one('customerRefTaken', lang, { ref });
      case 'no_box':
      case 'wrong_box':
      case 'no_account':
        return one('ownerNoBox', lang);
      default:
        return `${many ? `${ref}: ` : ''}${one('registerFailed', lang)}`;
    }
  },

  async _ownerSetPayment(ctx, refs, payment, slot) {
    const lines = [];
    for (const ref of refs) {
      const r = await this._registerOne(ctx, ref, { boxId: slot.boxId, date: slot.date, payment });
      lines.push({ ref, r });
    }
    this._clearSlot(ctx);
    return {
      outcome: lines.every((x) => x.r.success) ? `payment_${payment.type}` : 'payment_failed',
      template: payment.type === 'cod' ? 'ownerCodSaved' : 'ownerPrepaidSaved',
      reply: this._compose(ctx, (lang) =>
        lines.map(({ ref, r }) => {
          if (!r.success) return `${ref}: ${one('registerFailed', lang)}`;
          return payment.type === 'cod'
            ? one('ownerCodSaved', lang, { ref, amount: amountText(payment.amount, lang) })
            : one('ownerPrepaidSaved', lang, { ref });
        })
      ),
    };
  },

  // ---------------------------------------------------------------------------
  // List / status of one reference (F5)
  // ---------------------------------------------------------------------------

  /** One delivery on the caller's boxes by reference; null on API failure, false when not there. */
  async _findDelivery(ctx, ref) {
    const { status, data } = await llboxService.listDeliveries(ctx.phoneE164, { reference: ref, include_finished: true, limit: 5 });
    if (status !== 200) return null;
    const list = data?.deliveries || [];
    return list.find((d) => refKey(d.reference) === refKey(ref)) || list[0] || false;
  },

  _rangeFrom(ctx, lang) {
    const t = ctx.normalized.toLowerCase();
    const today = riyadhTodayIso(ctx.now);
    const plus = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    if (/\bnext\s+week\b|(الأسبوع|الاسبوع)\s+(الجاي|القادم)/.test(t)) {
      return { filters: { date_from: plus(7), date_to: plus(13) }, label: { en: 'next week', ar: 'الأسبوع القادم' } };
    }
    if (/\b(this\s+)?week\b|(هذا\s+)?(الأسبوع|الاسبوع)/.test(t)) {
      return { filters: { date_from: today, date_to: plus(6) }, label: { en: 'this week', ar: 'هذا الأسبوع' } };
    }
    const d = parseDeliveryDay(ctx.normalized, ctx.now);
    if (d.date && !d.issue) {
      const label =
        d.date === today
          ? { en: 'today', ar: 'اليوم' }
          : d.date === plus(1)
            ? { en: 'tomorrow', ar: 'غدًا' }
            : { en: `on ${dayLabel(d.date, 'en')}`, ar: `يوم ${dayLabel(d.date, 'ar')}` };
      return { filters: { date_from: d.date, date_to: d.date }, label };
    }
    return { filters: null, label: null };
  },

  _deliveryLine(ctx, d, lang, multi) {
    const ref = d.reference;
    let line;
    if (d.status === 'matched') line = one('ownerListOnWay', lang, { ref });
    else if (d.status === 'completed') line = one('ownerListDone', lang, { ref });
    else if (d.status === 'cancelled') line = one('ownerListCancelled', lang, { ref });
    else if (d.status === 'expired') line = one('ownerListExpired', lang, { ref });
    else if (d.expected_delivery_date) line = one('ownerListExpected', lang, { ref, dayName: dayLabel(d.expected_delivery_date, lang) });
    else line = one('ownerListRegistered', lang, { ref });
    if (multi) {
      const box = this._boxes(ctx).find((b) => b.boxId === d.box_id);
      line += ` (${this._boxLabel(box) || d.box_code})`;
    }
    return `• ${line}`;
  },

  async _ownerList(ctx) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    if (ctx.refs.length) return this._ownerRefStatus(ctx, ctx.refs.slice(0, MAX_REFS));
    const range = this._rangeFrom(ctx);
    const { status, data } = await llboxService.listDeliveries(ctx.phoneE164, { limit: 10, ...(range.filters || {}) });
    if (status !== 200) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
    const list = sortDeliveries(data?.deliveries || []);
    if (!list.length) {
      if (range.filters) {
        this._clearSlot(ctx);
        return this._out(ctx, 'list_empty', 'ownerListNoneInRange', (lang) => ({ range: range.label[lang] }));
      }
      this._setSlot(ctx, { intent: 'register', step: 'offerRegister' });
      return this._out(ctx, 'list_empty', 'ownerNothingOnWay');
    }
    const multi = this._boxes(ctx).length > 1;
    const total = range.filters ? list.length : Math.max(Number(ctx.identity.activeDeliveries || 0), list.length);
    const more = total - list.length;
    const cancellable = list.filter((d) => d.can_cancel);
    if (cancellable.length) this._setSlot(ctx, { intent: 'list', step: 'listed', options: cancellable.slice(0, 9).map(optionFrom) });
    else this._clearSlot(ctx);

    return {
      outcome: 'listed',
      template: 'ownerListIntro',
      reply: this._compose(ctx, (lang) => [
        [one(multi ? 'ownerListIntroMany' : 'ownerListIntro', lang), ...list.map((d) => this._deliveryLine(ctx, d, lang, multi))].join('\n'),
        more > 0 ? one('ownerListMore', lang, { n: more }) : '',
        cancellable.length ? one('ownerListCancelAsk', lang) : '',
      ]),
    };
  },

  async _ownerRefStatus(ctx, refs) {
    const found = [];
    for (const ref of refs) found.push({ ref, d: await this._findDelivery(ctx, ref) });
    if (found.some((x) => x.d === null)) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
    const missing = found.filter((x) => !x.d).map((x) => x.ref);
    const today = riyadhTodayIso(ctx.now);
    const overdue = (d) => d && d.status === 'pending' && d.expected_delivery_date && d.expected_delivery_date.slice(0, 10) < today;
    if (missing.length) this._setSlot(ctx, { intent: 'register', step: 'offerRegister', refs: missing });
    else if (found.length === 1 && overdue(found[0].d) && found[0].d.can_cancel) {
      this._setSlot(ctx, { intent: 'cancel', step: 'confirm', options: [optionFrom(found[0].d)] });
    } else this._clearSlot(ctx);
    return {
      outcome: 'reference_status',
      template: 'ownerRefStatus',
      reply: this._compose(ctx, (lang) =>
        found.map(({ ref, d }) => {
          if (!d) return one('ownerRefNotOnBox', lang, { ref });
          let key = `ownerRefStatus_${['pending', 'matched', 'completed', 'cancelled', 'expired'].includes(d.status) ? d.status : 'pending'}`;
          if (overdue(d)) key = d.can_cancel && found.length === 1 ? 'ownerRefStatus_overdue' : 'ownerRefStatus_overdueNote';
          return one(key, lang, { ref: d.reference, day: d.expected_delivery_date ? formatDay(d.expected_delivery_date, lang) : '' });
        })
      ),
    };
  },

  // ---------------------------------------------------------------------------
  // Cancel (F1, F6): look up → confirm → cancel. A cancel verb never registers.
  // ---------------------------------------------------------------------------

  async _ownerCancel(ctx) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    if (!ctx.refs.length) {
      const { status, data } = await llboxService.listDeliveries(ctx.phoneE164, { limit: 30 });
      if (status !== 200) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
      const options = sortDeliveries(data?.deliveries || []).filter((d) => d.can_cancel).slice(0, 9).map(optionFrom);
      return this._ownerCancelPick(ctx, options);
    }

    const items = [];
    for (const ref of ctx.refs.slice(0, MAX_REFS)) {
      const d = await this._findDelivery(ctx, ref);
      if (d === null) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
      items.push({ ref, d });
    }
    const cancellable = items.filter((x) => x.d && x.d.can_cancel).map((x) => optionFrom(x.d));
    const notes = (lang) =>
      items
        .filter((x) => !x.d || !x.d.can_cancel)
        .map(({ ref, d }) => {
          if (!d) return one('ownerCancelNotFound', lang, { ref });
          if (d.status === 'cancelled') return one('ownerAlreadyCancelled', lang, { ref: d.reference });
          if (d.status === 'matched') return one('ownerCancelTooLate', lang, { ref: d.reference });
          return one('ownerCancelFinished', lang, { ref: d.reference });
        });
    if (!cancellable.length) {
      this._clearSlot(ctx);
      return { outcome: 'cancel_not_possible', template: 'ownerCancelNotPossible', reply: this._compose(ctx, notes) };
    }
    const confirm = this._ownerCancelConfirm(ctx, cancellable);
    return { ...confirm, reply: this._compose(ctx, (lang) => [...notes(lang), this._cancelConfirmText(cancellable, lang)]) };
  },

  _ownerCancelPick(ctx, options) {
    if (!options.length) {
      this._clearSlot(ctx);
      return this._out(ctx, 'cancel_nothing', 'ownerNothingToCancel');
    }
    if (options.length === 1) return this._ownerCancelConfirm(ctx, options);
    this._setSlot(ctx, { intent: 'cancel', step: 'pick', options });
    return this._out(ctx, 'cancel_pick', 'ownerCancelPick', (lang) => ({
      options: options
        .map((o, i) => `${i + 1}. ${o.ref}${o.date ? ` — ${dayLabel(o.date, lang)}` : ''}`)
        .join('\n'),
    }));
  },

  _cancelConfirmText(items, lang) {
    const day =
      items.length === 1 && items[0].date
        ? lang === 'ar'
          ? ` (المتوقع يوم ${dayLabel(items[0].date, lang)})`
          : ` (expected ${dayLabel(items[0].date, lang)})`
        : '';
    return one('ownerCancelConfirm', lang, { ref: items.map((o) => o.ref).join(', '), day });
  },

  _ownerCancelConfirm(ctx, items) {
    this._setSlot(ctx, { intent: 'cancel', step: 'confirm', options: items });
    return {
      outcome: 'cancel_confirm',
      template: 'ownerCancelConfirm',
      reply: this._compose(ctx, (lang) => [this._cancelConfirmText(items, lang)]),
    };
  },

  async _ownerDoCancel(ctx, items) {
    const results = [];
    for (const item of items) {
      const { status, data } = await llboxService.cancelDelivery(ctx.phoneE164, item.id);
      logger.info(`[owner] cancel ${item.ref} id=${item.id} status=${status} ${data?.code || ''}`);
      results.push({ item, status, data });
    }
    this._clearSlot(ctx);
    return {
      outcome: results.every((x) => x.status === 200) ? 'cancelled' : 'cancel_partly',
      template: 'ownerCancelled',
      reply: this._compose(ctx, (lang) =>
        results.map(({ item, status, data }) => {
          const ref = item.ref;
          if (status === 200) return /already/i.test(data?.message || '') ? one('ownerAlreadyCancelled', lang, { ref }) : one('ownerCancelled', lang, { ref });
          if (status === 409) {
            return /finish|complet|deliver/i.test(data?.message || '') ? one('ownerCancelFinished', lang, { ref }) : one('ownerCancelTooLate', lang, { ref });
          }
          if (status === 404) return one('ownerCancelNotFound', lang, { ref });
          return `${ref}: ${one('ownerUnavailable', lang)}`;
        })
      ),
    };
  },

  // ---------------------------------------------------------------------------
  // Codes (F3, F7): guest code, or a replacement for a driver's delivery. Never stored, never re-read.
  // ---------------------------------------------------------------------------

  async _ownerGuestCode(ctx, { boxId } = {}) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    let id = boxId;
    if (!id) {
      const pick = this._needBox(ctx, { intent: 'guestCode' });
      if (pick.ask) return pick.ask;
      id = pick.boxId;
    }
    const { status, data } = await llboxService.issueCode(ctx.phoneE164, { boxId: id });
    logger.info(`[owner] guest code box=${id} status=${status}`);
    if (ok2xx(status) && data?.code) {
      this._clearSlot(ctx);
      const multi = this._boxes(ctx).length > 1;
      const box = this._boxes(ctx).find((b) => b.boxId === id);
      const expires = Date.parse(data.expires_at || '');
      const withinHour = Number.isFinite(expires) && expires - ctx.now <= 65 * 60 * 1000;
      return {
        outcome: 'guest_code',
        template: 'ownerGuestCode',
        otpIssued: true,
        reply: this._compose(ctx, (lang) => [
          one('ownerGuestCode', lang, {
            box: multi ? ` (${this._boxLabel(box)})` : '',
            code: data.code,
            validity: !Number.isFinite(expires)
              ? ''
              : withinHour
                ? one('codeValidHour', lang)
                : one('codeValidUntil', lang, { when: timeLabel(data.expires_at, lang) }),
          }),
        ]),
      };
    }
    if (status === 422 && String(data?.code || '').toUpperCase() === 'BOX_SELECTION_REQUIRED') {
      return this._askBox(ctx, { intent: 'guestCode' });
    }
    return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
  },

  async _ownerReplaceCode(ctx) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    if (ctx.own.flags.guest && !ctx.refs.length && !ctx.own.flags.driverMention) return this._ownerGuestCode(ctx);
    if (ctx.refs.length) {
      const d = await this._findDelivery(ctx, ctx.refs[0]);
      if (d === null) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
      if (!d) return this._out(ctx, 'reference_not_found', 'ownerRefNotFound', { ref: ctx.refs[0] });
      return this._ownerIssueReplacement(ctx, optionFrom(d));
    }
    let resp = await llboxService.listDeliveries(ctx.phoneE164, { status: ['matched', 'pending'], limit: 20 });
    if (resp.status === 400) resp = await llboxService.listDeliveries(ctx.phoneE164, { limit: 20 });
    if (resp.status !== 200) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
    const list = sortDeliveries(resp.data?.deliveries || []).filter((d) => ['matched', 'pending'].includes(d.status));
    const matched = list.filter((d) => d.status === 'matched');
    if (matched.length === 1) return this._ownerIssueReplacement(ctx, optionFrom(matched[0]));
    const options = list.slice(0, 6).map(optionFrom);
    if (!options.length) {
      this._clearSlot(ctx);
      return this._out(ctx, 'no_delivery_for_code', 'ownerNoDeliveryForCode');
    }
    this._setSlot(ctx, { intent: 'replaceCode', step: 'pick', options });
    return this._out(ctx, 'replace_pick', 'ownerReplaceAsk', (lang) => ({
      options: options
        .map((o, i) => {
          const tail = o.status === 'matched' ? one('ownerListOnWay', lang, { ref: '' }) : o.date ? one('ownerListExpected', lang, { ref: '', dayName: dayLabel(o.date, lang) }) : '';
          return `${i + 1}. ${o.ref}${tail ? ` ${tail.trim()}` : ''}`;
        })
        .join('\n'),
    }));
  },

  async _ownerIssueReplacement(ctx, opt) {
    if (!['pending', 'matched'].includes(opt.status)) {
      this._clearSlot(ctx);
      return this._out(ctx, 'code_refused', 'ownerCodeRefused', (lang) => ({ ref: opt.ref, status: STATUS_WORD[lang][opt.status] || opt.status }));
    }
    const { status, data } = await llboxService.issueCode(ctx.phoneE164, { boxId: opt.boxId, deliveryId: opt.id });
    logger.info(`[owner] replacement code ${opt.ref} id=${opt.id} status=${status}`);
    if (ok2xx(status) && data?.code) {
      this._clearSlot(ctx);
      return {
        outcome: 'replacement_code',
        template: 'ownerReplacedCode',
        otpIssued: true,
        orderReference: opt.ref,
        reply: this._compose(ctx, (lang) => [
          one('ownerReplacedCode', lang, { ref: data.linked_delivery?.reference || opt.ref, code: data.code }),
        ]),
      };
    }
    this._clearSlot(ctx);
    if (status === 409 || status === 422) {
      return this._out(ctx, 'code_refused', 'ownerCodeRefused', (lang) => ({ ref: opt.ref, status: STATUS_WORD[lang].completed }));
    }
    return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
  },

  // ---------------------------------------------------------------------------
  // Box status (F7) and the box's number (F9)
  // ---------------------------------------------------------------------------

  async _ownerBoxStatus(ctx) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    if (ctx.refs.length) return this._ownerRefStatus(ctx, ctx.refs.slice(0, MAX_REFS));
    const { status, data } = await llboxService.boxStatus(ctx.phoneE164);
    const boxes = data?.boxes || [];
    if (status !== 200 || !boxes.length) return this._out(ctx, 'owner_unavailable', 'ownerUnavailable');
    let onWay = [];
    if (boxes.some((b) => !b.parcel_inside)) {
      const r = await llboxService.listDeliveries(ctx.phoneE164, { status: ['matched'], limit: 5 });
      onWay = r.status === 200 ? (r.data?.deliveries || []).filter((d) => d.status === 'matched') : [];
    }
    const multi = boxes.length > 1;
    this._clearSlot(ctx);
    return {
      outcome: 'box_status',
      template: 'ownerBoxStatus',
      reply: this._compose(ctx, (lang) =>
        boxes.map((b) => {
          const label = multi ? ` (${b.nickname || b.box_code})` : '';
          const refsHere = onWay.filter((d) => d.box_id === b.box_id || d.box_code === b.box_code).map((d) => d.reference);
          const first = b.parcel_inside
            ? one('ownerBoxParcelInside', lang, { box: label })
            : refsHere.length
              ? one('ownerBoxEmptyOnWay', lang, { box: label, refs: refsHere.join(', ') })
              : one('ownerBoxEmpty', lang, { box: label });
          const full = b.parcel_inside && b.box_full_percent != null ? one('ownerBoxFull', lang, { p: b.box_full_percent }) : '';
          const today = b.deliveries_expected_today
            ? one('ownerBoxToday', lang, { n: b.deliveries_expected_today, comfortable: b.comfortable_per_day ?? '-', most: b.most_per_day ?? '-' })
            : '';
          const battery = b.battery_level != null ? (lang === 'ar' ? `، البطارية ${b.battery_level}٪` : `, battery ${b.battery_level}%`) : '';
          let health;
          if (b.health === 'ok') health = one('ownerBoxOnline', lang, { battery });
          else if (b.health === 'offline') health = one('ownerBoxOffline', lang, { when: timeLabel(b.last_seen_at, lang) || '-', battery });
          else if (b.health === 'out_of_service') health = one('ownerBoxOutOfService', lang);
          else health = one('ownerBoxUnknown', lang);
          return [first, full, today, health].filter(Boolean).join('\n');
        })
      ),
    };
  },

  async _ownerBoxNumber(ctx) {
    if (!this._hasBox(ctx)) return this._ownerNoBox(ctx);
    const boxes = this._boxes(ctx);
    const multi = boxes.length > 1;
    const shared = String(process.env.LLBOX_DRIVER_WHATSAPP_NUMBER || '').trim();
    const withNumber = boxes.filter((b) => b.phoneNumber);
    const without = boxes.length - withNumber.length;
    this._clearSlot(ctx);
    if (!withNumber.length && !shared) {
      const support = await llboxService.supportContact();
      return {
        outcome: 'box_number_unknown',
        template: 'ownerCannotHelp',
        reply: this._compose(ctx, (lang) => [one('ownerCannotHelp', lang), this._supportText(support, lang)]),
      };
    }
    return {
      outcome: 'box_number',
      template: 'ownerBoxNumber',
      reply: this._compose(ctx, (lang) => [
        ...withNumber.map((b) => one('ownerBoxNumber', lang, { box: multi ? ` (${this._boxLabel(b)})` : '', phone: b.phoneNumber })),
        without && shared ? one('ownerBoxNumberShared', lang, { phone: shared }) : '',
      ]),
    };
  },

  // ---------------------------------------------------------------------------
  // Report issue (F8, F16), account requests (F15), preferences (F9), support route
  // ---------------------------------------------------------------------------

  async _ownerReport(ctx, opts = {}) {
    const category = opts.category || ctx.own.flags.issueCategory || '';
    const description = String(opts.description || ctx.raw || '').trim();
    const words = description.split(/\s+/).filter(Boolean).length;
    if (!category && !opts.description && words < 4) {
      this._setSlot(ctx, { intent: 'report', step: 'describe' });
      return this._out(ctx, 'report_ask', 'ownerReportAsk');
    }
    const cat = category || 'other';
    const last = ctx.state.lastTicket || {};
    if (last.ticketId && last.category === cat && last.at && ctx.now - new Date(last.at).getTime() < TICKET_DEDUPE_MS) {
      this._clearSlot(ctx);
      return this._out(ctx, 'report_duplicate', 'ownerReportedAlready', { ticket: last.ticketId });
    }
    let { boxId } = opts;
    if (!boxId && this._hasBox(ctx)) {
      const pick = this._needBox(ctx, { intent: 'report', category: cat, description });
      if (pick.ask) return pick.ask;
      boxId = pick.boxId;
    }
    let deliveryId;
    if (ctx.refs.length) {
      const d = await this._findDelivery(ctx, ctx.refs[0]);
      if (d) deliveryId = d.delivery_id;
    }
    const { status, data } = await llboxService.reportIssue(ctx.phoneE164, { category: cat, description, boxId, deliveryId });
    logger.info(`[owner] report-issue ${cat} box=${boxId || '-'} status=${status} ticket=${data?.ticket_id || '-'}`);
    const support = await llboxService.supportContact();
    if (ok2xx(status) && data?.ticket_id) {
      this._clearSlot(ctx);
      ctx.updates.$set.lastTicket = { category: cat, ticketId: String(data.ticket_id), at: new Date(ctx.now) };
      return {
        outcome: 'issue_reported',
        template: 'ownerReported',
        ticketId: data.ticket_id,
        reply: this._compose(ctx, (lang) => [
          one('ownerReported', lang, { ticket: data.ticket_id }),
          cat === 'theft' ? one('ownerTheftAdvice', lang) : '',
          support.configured ? this._supportText(support, lang) : '',
        ]),
      };
    }
    if (status === 422 && String(data?.code || '').toUpperCase() === 'BOX_SELECTION_REQUIRED') {
      return this._askBox(ctx, { intent: 'report', category: cat, description });
    }
    this._clearSlot(ctx);
    return {
      outcome: 'report_failed',
      template: 'ownerReportFailed',
      reply: this._compose(ctx, (lang) => [one('ownerReportFailed', lang), this._supportText(support, lang)]),
    };
  },

  async _ownerAccountChange(ctx) {
    const t = ctx.normalized.toLowerCase();
    const kind = /\b(delete|close|remove|deactivate)\b|حذف|احذف|اقفل|أقفل|إلغاء|الغاء/.test(t)
      ? 'delete'
      : /\b(add|invite)\b|إضافة|اضافة|أضف|اضف|ضيف/.test(t)
        ? 'member'
        : /\b(phone|mobile|whatsapp|number)\b|رقم|جوال/.test(t)
          ? 'phone'
          : 'details';
    const WHAT = {
      delete: { en: 'delete your account', ar: 'حذف حسابك' },
      member: { en: 'add someone to your box', ar: 'إضافة شخص إلى صندوقك' },
      phone: { en: 'change your phone number', ar: 'تغيير رقم جوالك' },
      details: { en: 'change your account details', ar: 'تعديل بيانات حسابك' },
    }[kind];
    const support = await llboxService.supportContact();
    const last = ctx.state.lastTicket || {};
    if (last.ticketId && last.category === `account_${kind}` && last.at && ctx.now - new Date(last.at).getTime() < TICKET_DEDUPE_MS) {
      return this._out(ctx, 'report_duplicate', 'ownerReportedAlready', { ticket: last.ticketId });
    }
    const { status, data } = await llboxService.reportIssue(ctx.phoneE164, {
      category: 'other',
      description: `Account request via WhatsApp (${kind}): ${ctx.raw}`,
      boxId: this._boxes(ctx)[0]?.boxId,
    });
    logger.info(`[owner] account request ${kind} status=${status} ticket=${data?.ticket_id || '-'}`);
    this._clearSlot(ctx);
    if (ok2xx(status) && data?.ticket_id) {
      ctx.updates.$set.lastTicket = { category: `account_${kind}`, ticketId: String(data.ticket_id), at: new Date(ctx.now) };
      return {
        outcome: 'account_request_passed',
        template: 'ownerAccountChange',
        ticketId: data.ticket_id,
        reply: this._compose(ctx, (lang) => [
          one('ownerAccountChange', lang, { what: WHAT[lang], ticket: data.ticket_id }),
          support.configured ? this._supportText(support, lang) : '',
        ]),
      };
    }
    return {
      outcome: 'account_request_failed',
      template: 'ownerCannotHelp',
      reply: this._compose(ctx, (lang) => [one('ownerCannotHelp', lang), this._supportText(support, lang)]),
    };
  },

  async _ownerPrefs(ctx, intent) {
    const MAP = {
      optOut: [{ whatsappOptOut: true }, 'ownerOptedOut'],
      optIn: [{ whatsappOptOut: false }, 'ownerOptedIn'],
      driverContactOff: [{ allowDriverContact: false }, 'ownerDriverContactOff'],
      driverContactOn: [{ allowDriverContact: true }, 'ownerDriverContactOn'],
    };
    const [prefs, key] = MAP[intent];
    const { status } = await llboxService.setPreferences(ctx.phoneE164, prefs);
    logger.info(`[owner] preferences ${JSON.stringify(prefs)} status=${status}`);
    this._clearSlot(ctx);
    if (ok2xx(status)) return this._out(ctx, `preferences_${intent}`, key);
    return this._out(ctx, 'preferences_failed', 'ownerPrefFailed');
  },

  async _ownerSupport(ctx) {
    const support = await llboxService.supportContact();
    this._clearSlot(ctx);
    return {
      outcome: support.configured ? 'support_contact' : 'support_not_configured',
      template: support.configured ? 'supportConfigured' : 'supportNotConfigured',
      reply: this._compose(ctx, (lang) => [this._supportText(support, lang)]),
    };
  },

  _supportText(support, lang) {
    if (!support || !support.configured) return one('supportNotConfigured', lang);
    const L = lang === 'ar'
      ? { phone: 'الهاتف', whatsapp: 'واتساب', email: 'البريد الإلكتروني', hours: 'أوقات العمل' }
      : { phone: 'Phone', whatsapp: 'WhatsApp', email: 'Email', hours: 'Hours' };
    const lines = ['phone', 'whatsapp', 'email', 'hours'].filter((k) => support[k]).map((k) => `${L[k]}: ${support[k]}`);
    return lines.length ? one('supportConfigured', lang, { lines: lines.join('\n') }) : one('supportNotConfigured', lang);
  },

  // ---------------------------------------------------------------------------
  // Cancelled-arrival: owner answers YES / NO on WhatsApp
  // ---------------------------------------------------------------------------

  async _ownerArrivalAnswer(ctx, own) {
    const answering = Boolean(own.flags.yes || own.flags.no);
    if (!answering) return null;
    // Only a bare yes/no (or yes/no with the reference) should claim an open arrival question.
    if (own.intent && !['greeting', 'menu', ''].includes(own.intent) && own.intent !== 'list') return null;
    if (own.flags.selfDriver || own.flags.manipulation) return null;
    const { status, data } = await llboxService.arrivalRequestsFor(ctx.phoneE164);
    const open = status === 200 ? data?.requests || data?.open || [] : [];
    if (!open.length) return null;
    let pick = open[0];
    if (ctx.refs.length) {
      const hit = open.find((r) => refKey(r.reference || r.order_reference || '') === refKey(ctx.refs[0]));
      if (hit) pick = hit;
    }
    const requestId = pick.request_id || pick.id;
    if (!requestId) return null;
    const approve = Boolean(own.flags.yes);
    const responded = await llboxService.arrivalRespond(ctx.phoneE164, requestId, approve);
    logger.info(`[owner] arrival-respond ${requestId} approve=${approve} status=${responded.status}`);
    if (!ok2xx(responded.status) && responded.status !== 409) return null;
    const ref = pick.reference || pick.order_reference || ctx.refs[0] || '';
    this._clearSlot(ctx);
    return this._out(ctx, approve ? 'arrival_approved' : 'arrival_declined', approve ? 'cancelledArrivalOwnerYes' : 'cancelledArrivalOwnerNo', { ref });
  },

  // ---------------------------------------------------------------------------

  _out(ctx, outcome, key, vars = {}) {
    return { outcome, template: key, reply: this._say(ctx, key, vars) };
  },
};
