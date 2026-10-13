#!/usr/bin/env node
/**
 * Driver edge cases from LLBox_X360_Full_Test_Report_2026-10-04 (R1 Roman Hindi, R3 spaced references,
 * R4 emoji/sticker, F1 driver-contact for COD / dead box / oversized parcel).
 * LLBox calls are stubbed so no code is consumed, no number is released and the QA app is not notified.
 * The issue classifier (OpenAI) runs for real. Usage: node scripts/driver-edge-regression.js
 */

require('dotenv').config({ quiet: true });

const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1];
const fs = require('fs');
const mongoose = require('mongoose');
const llboxService = require('../services/llbox.service');
const journeyService = require('../services/journey.service');
const followUpService = require('../services/followup.service');
const turnService = require('../services/turn.service');
const TurnState = require('../models/TurnState');

const CUSTOMER_PHONE = '+966511112222';
const calls = { contact: [], notify: [], peek: [], resolve: [], review: [] };
let script = {};

llboxService.identifyWhatsapp = async () => ({ userFound: false, boxes: [] });
llboxService.peekReference = async (ref) => {
  calls.peek.push(ref);
  return script.peek || { status: 200, data: { reference: ref, payment_type: 'unknown', max_parcel_cm: null } };
};
llboxService.driverContact = async (args) => {
  calls.contact.push(args);
  const queue = script.contact || [];
  return queue.length > 1 ? queue.shift() : queue[0] || { status: 404, data: { released: false, reason: 'not_available' } };
};
llboxService.deliveryStatus = async (ref) => script.status || { status: 200, data: { reference: ref, completed: false } };
journeyService.handleNotifyRecipient = async (args) => {
  calls.notify.push(args);
  return { success: true, notified: true, outcome: 'notified' };
};
journeyService.handleDriverVerification = async (ref) => {
  calls.resolve.push(ref);
  return {
    success: true,
    orderReference: ref,
    paymentType: script.paymentType || 'unknown',
    sayByLanguage: { en: `HANDOVER ${ref}`, ar: `تسليم ${ref}` },
    boxPhotos: [],
  };
};
followUpService.scheduleDeliveryStatus = async () => {};
followUpService.scheduleContactReview = async (args) => {
  calls.review.push(args);
};

const released = (extra = {}) => ({
  status: 200,
  data: {
    released: true,
    request_id: 'req-1',
    contact: { type: 'phone', phone: CUSTOMER_PHONE, valid_until: '2026-10-08T10:00:00Z' },
    recipient_first_name: 'Sara',
    customer_notified: true,
    ...extra,
  },
});
const conflict = (reason) => ({ status: 409, data: { released: false, reason } });

const has = (s) => (r) => r.reply.includes(s);
const lacks = (s) => (r) => !r.reply.includes(s);
const contactReason = (reason) => () => calls.contact.length > 0 && calls.contact.every((c) => c.reason === reason);
const noContact = () => calls.contact.length === 0;
const notified = (issue) => () => calls.notify.some((c) => c.issue === issue);
const convIdSent = () => calls.contact.every((c) => /^x360-[0-9a-f]{24}$/.test(c.conversationId || ''));
const AR_RX = /[\u0600-\u06FF]/;

const SCENARIOS = [
  // R1: Roman Hindi / Hinglish problems with a reference
  { id: 'R1a', text: 'bhai code nahi chal raha SPL77100200', contact: [conflict('box_online')], checks: { reason: contactReason('box_unresponsive'), convIdSent, retry: has('try the code once more') } },
  { id: 'R1b', text: 'box khul nahi raha hai order SPL77100201', contact: [conflict('box_online')], checks: { reason: contactReason('box_unresponsive') } },
  { id: 'R1c', text: 'parcel bahut bada hai box mein nahi jayega SPL77100202', peek: { status: 200, data: { max_parcel_cm: { length: 50, width: 40, height: 30 } } }, checks: { asksSize: has('length, width and height'), noContact } },
  { id: 'R1c2', phoneOf: 'R1c', text: '60 x 40 x 30', contact: [released()], checks: { reason: contactReason('parcel_too_large'), dims: () => calls.contact[0]?.parcelCm?.length === 60, phone: has(CUSTOMER_PHONE), oneOff: has('this delivery only') } },
  { id: 'R1d', text: 'box full hai jagah nahi hai SPL77100203', checks: { notify: notified('box_full'), noContact } },
  { id: 'R1e', text: 'box nahi mil raha location bhejo SPL77100204', checks: { notify: notified('cannot_find_box'), handover: has('HANDOVER') } },
  { id: 'R1f', text: 'customer phone nahi utha raha SPL77100205', checks: { cleanRef: (r) => r.references.length === 1 && r.references[0] === 'SPL77100205', notify: notified('other'), noPhone: lacks(CUSTOMER_PHONE), noContact } },
  { id: 'R1g', text: 'customer se cash lena hai, cash on delivery hai SPL77100206', peek: { status: 200, data: { payment_type: 'cod', cod_amount: 350 } }, contact: [released({ cod_amount: 350 })], checks: { reason: contactReason('cod'), amount: has('350 SAR'), phone: has(CUSTOMER_PHONE) } },
  { id: 'R1h', text: 'mujhe customer ka number chahiye SPL77100207', checks: { notify: notified('other'), noPhone: lacks(CUSTOMER_PHONE), noContact } },
  { id: 'R1i', text: 'bhai code kaam nahi kar raha', checks: { asksRef: has('order number'), noContact } },
  { id: 'R1i2', phoneOf: 'R1i', text: 'SPL77100208', contact: [conflict('box_online')], checks: { reason: contactReason('box_unresponsive') } },
  { id: 'R1j', text: 'bhai yeh dabba toh band pada hai, light bhi nahi jal rahi, kuch nahi ho raha SPL77100209', contact: [conflict('box_online')], checks: { reason: contactReason('box_unresponsive') } },
  { id: 'R1k', text: 'gate pe guard hai usko de du kya SPL77100210', checks: { cleanRef: (r) => r.references.length === 1 && r.references[0] === 'SPL77100210', notify: notified('other'), noContact } },
  { id: 'R1l', text: 'darwaza band hai aur customer ka phone band aa raha hai SPL77100211', checks: { cleanRef: (r) => r.references.length === 1 && r.references[0] === 'SPL77100211', notify: notified('other'), noContact } },
  // R3: spaced references join into one
  { id: 'R3a', text: 'spl 88 123456', checks: { oneRef: (r) => r.references.length === 1 && /spl\s*-?\s*88\s*-?\s*123456/i.test(r.references[0]) } },
  { id: 'R3b', text: 'order is NQ 4455 6677 88', checks: { oneRef: (r) => r.references.length === 1 && r.references[0].replace(/\W/g, '') === 'NQ4455667788' } },
  { id: 'R3c', text: 'flat 12 554433', checks: { ref: (r) => r.references[0] === '554433' } },
  // COD
  { id: 'C1', text: 'customer wants to pay cash on delivery', checks: { asksRef: has('order number'), noContact } },
  { id: 'C1b', phoneOf: 'C1', text: 'SPL77100212', peek: { status: 200, data: { payment_type: 'prepaid' } }, checks: { prepaid: has('already paid'), noContact } },
  { id: 'C2', text: 'COD order, need to collect cash SPL77100213', contact: [{ status: 403, data: { released: false, reason: 'customer_opted_out' } }], checks: { optedOut: has('prefers not to be called'), noPhone: lacks(CUSTOMER_PHONE) } },
  { id: 'C3', text: 'COD order, need to collect cash SPL77100214', contact: [{ status: 404, data: { released: false, reason: 'not_available' } }], checks: { full: has('send it in full') } },
  { id: 'C4', text: 'COD order, need to collect cash SPL77100215', contact: [{ status: 429, data: { code: 'rate_limited' } }], checks: { cleanRef: (r) => r.references.length === 1 && r.references[0] === 'SPL77100215', passedOn: has("I've let them know"), notify: notified('other') } },
  { id: 'C5', text: 'SPL77100216', paymentType: 'cod', checks: { handover: has('HANDOVER'), codNote: has('cash on delivery') } },
  // Dead box
  { id: 'D1', text: 'the box is dead, no light, keypad not working SPL77100217', contact: [{ status: 202, data: { released: false, request_id: 'req-202', pending_review: true } }], checks: { pending: has("I'll message you here"), review: () => calls.review[0]?.requestId === 'req-202' && /^x360-/.test(calls.review[0]?.conversationId) } },
  { id: 'D2', text: 'code not working SPL77100218', contact: [conflict('box_online')], checks: { retry: has('six digits') } },
  { id: 'D2b', phoneOf: 'D2', text: 'still not working SPL77100218', contact: [conflict('box_online')], checks: { notify: notified('code_not_working') } },
  { id: 'D3', text: 'box not responding SPL77100219', contact: [released()], checks: { phone: has(CUSTOMER_PHONE), name: has('Sara'), told: has("let them know you're calling") } },
  // Oversized
  { id: 'O1', text: 'parcel too big for the box SPL77100220', contact: [{ status: 422, data: { released: false, reason: 'parcel_size_required' } }], checks: { asksSize: has('length, width and height') } },
  { id: 'O1b', phoneOf: 'O1', text: 'its 45 by 35 by 25 cm', contact: [conflict('parcel_fits')], checks: { fits: has('smallest side'), dims: () => calls.contact[0]?.parcelCm?.height === 25 } },
  // R4: sticker, emoji, "???"
  { id: 'E1', text: '', inputType: 'sticker', checks: { sticker: has("can't read stickers") } },
  { id: 'E2', text: '🚚📦', checks: { asks: (r) => r.outcome === 'ask_reference' } },
  { id: 'E3', text: '???', checks: { bilingual: (r) => AR_RX.test(r.reply) && /[a-z]{4}/i.test(r.reply) } },
];

const phoneFor = (id) => `+1998${String(Date.now()).slice(-5)}${String(id).replace(/\W/g, '').slice(-3).padStart(3, '0')}`;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const phones = {};
  const results = [];
  for (const sc of SCENARIOS) {
    for (const k of Object.keys(calls)) calls[k].length = 0;
    script = { peek: sc.peek, contact: sc.contact ? [...sc.contact] : undefined, paymentType: sc.paymentType };
    const key = sc.phoneOf || sc.id;
    phones[key] = phones[key] || phoneFor(key);
    const r = await turnService.handle({ phone: phones[key], text: sc.text, inputType: sc.inputType });
    const failed = Object.entries(sc.checks)
      .filter(([, fn]) => {
        try {
          return !fn(r);
        } catch (e) {
          return true;
        }
      })
      .map(([name]) => name);
    results.push({ id: sc.id, pass: !failed.length, failed, outcome: r.outcome, contact: calls.contact.map((c) => c.reason).join(',') || '-', notify: calls.notify.map((c) => c.issue).join(',') || '-', reply: r.reply });
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // The released customer number must never be persisted.
  const docs = await TurnState.find({ phoneDigits: { $regex: '^1998' } }).lean();
  const leaked = docs.filter((d) => JSON.stringify(d).includes(CUSTOMER_PHONE.slice(1))).length;
  results.push({ id: 'PRIV', pass: leaked === 0, failed: leaked ? ['phoneStored'] : [], outcome: `docs with customer phone: ${leaked}`, contact: '-', notify: '-', reply: '' });

  for (const res of results) {
    console.log(`\n#${res.id} ${res.pass ? 'PASS' : 'FAIL ' + res.failed.join(',')} | outcome=${res.outcome} | contact=${res.contact} | notify=${res.notify}`);
    if (res.reply) console.log(res.reply.split('\n').map((l) => `   ${l}`).join('\n'));
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passed}/${results.length} driver edge checks passed ===`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ suite: 'driver-edge', passed, total: results.length, results }, null, 2));
  await TurnState.deleteMany({ phoneDigits: { $regex: '^1998' } });
  await mongoose.disconnect();
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
