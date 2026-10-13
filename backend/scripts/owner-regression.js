#!/usr/bin/env node
/**
 * Owner-mode regression for LLBox_X360_Full_Test_Report_2026-10-04 Part B (F1–F19), run as LLBox's QA owner
 * against live LLBox (identify, deliveries, register, cancel, box-status, support). Codes, tickets and
 * preferences are stubbed so the owner's app gets no tickets or opt-outs. No WhatsApp is sent.
 * Test deliveries are created with unique references and cancelled at the end.
 * Usage: node scripts/owner-regression.js [+966571099035]
 */

require('dotenv').config({ quiet: true });

const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1];
const fs = require('fs');
const mongoose = require('mongoose');
const llboxService = require('../services/llbox.service');
const turnService = require('../services/turn.service');
const TurnState = require('../models/TurnState');
const { digitsOnly } = require('../utils/phone');

const OWNER = process.argv.slice(2).find((a) => /^\+?\d{8,15}$/.test(a)) || '+966571099035';
const tag = String(Date.now()).slice(-5);
const REF = (c) => `X360T${tag}${c}`;
const stubs = { code: [], report: [], prefs: [] };

// Never release a real customer number from a test run.
llboxService.driverContact = async () => ({ status: 404, data: { released: false, reason: 'not_available' } });
llboxService.peekReference = async () => ({ status: 404, data: {} });
llboxService.issueCode = async (phone, args) => {
  stubs.code.push(args);
  return { status: 200, data: { code: '482913', expires_at: new Date(Date.now() + 3600e3).toISOString(), linked_delivery: args.deliveryId ? { delivery_id: args.deliveryId } : null } };
};
llboxService.reportIssue = async (phone, args) => {
  stubs.report.push(args);
  return { status: 201, data: { ticket_id: `T-${stubs.report.length}` } };
};
llboxService.setPreferences = async (phone, args) => {
  stubs.prefs.push(args);
  return { status: 200, data: { preferences: { whatsapp_opt_out: Boolean(args.whatsappOptOut), allow_driver_contact: args.allowDriverContact !== false } } };
};

const AR_RX = /[\u0600-\u06FF]/;
const has = (s) => (r) => r.reply.includes(s);
const lacks = (s) => (r) => !r.reply.includes(s);
const out = (o) => (r) => r.outcome === o;
const outIn = (...o) => (r) => o.includes(r.outcome);
const notRegistered = (r) => !/^registered/.test(r.outcome) && !/is registered for/.test(r.reply);
const ownerActor = (r) => r.actor === 'customer';
const noDriverWording = lacks('Send the order number');

const SCENARIOS = [
  { id: 'F3 greeting', text: 'Hi', checks: { ownerActor, out: out('owner_greeting'), name: has('Khalid'), menu: has('1. Register'), noDriverWording } },
  { id: 'F7 menu digit', text: '2', checks: { out: out('listed'), list: has("Here's what's coming") } },
  { id: 'F1 cancel unknown never registers', text: 'cancel ZZZ99887766', checks: { notRegistered, out: outIn('cancel_not_possible', 'cancel_nothing') } },
  { id: 'F2 register asks day', text: `please register ${REF('A')}`, checks: { out: out('register_ask_day') } },
  { id: 'F2 day answer', text: 'in 9 days', checks: { out: out('registered'), ref: has(REF('A')), cod: has('cash on delivery') } },
  { id: 'F3-COD not sure', text: "not sure, i'll check", checks: { out: out('payment_unknown') } },
  { id: 'F8 status by ref', text: `where is ${REF('A')}`, checks: { out: out('reference_status'), waiting: has('waiting for the driver') } },
  { id: 'F1 cancel by ref confirms', text: `cancel ${REF('A')}`, checks: { out: out('cancel_confirm'), notRegistered } },
  { id: 'F1 cancel yes', text: 'yes', checks: { out: out('cancelled'), done: has('Cancelled') } },
  { id: 'F2 stale ref not reused', text: 'tomorrow', checks: { notRegistered, noRef: lacks(REF('A')) } },
  { id: 'F12 three refs', text: `${REF('B')} ${REF('C')} ${REF('D')}`, checks: { out: outIn('register_ask_day', 'register_box_capacity_exceeded'), oneFullLine: (r) => (r.reply.match(/most your box can take/g) || []).length <= 1 } },
  { id: 'F10 relative day', text: 'in 10 days', checks: { out: out('registered'), all: (r) => [REF('B'), REF('C'), REF('D')].every((x) => r.reply.includes(x)) } },
  { id: 'F3-COD for all', text: 'COD 200 riyal for all of them', checks: { out: out('payment_cod'), all: (r) => [REF('B'), REF('C'), REF('D')].every((x) => r.reply.includes(x)) } },
  { id: 'F6 cancel several', text: `cancel ${REF('B')}, ${REF('C')} and ${REF('D')}`, checks: { out: out('cancel_confirm') } },
  { id: 'F6 cancel no', text: 'no', checks: { out: out('cancel_kept') } },
  { id: 'F10 past day', text: `register ${REF('E')} for yesterday`, checks: { out: out('register_day_past'), notRegistered } },
  { id: 'F11 >120 days', text: `register ${REF('E')} in 200 days`, checks: { out: out('register_day_too_far'), says120: has('120 days') } },
  { id: 'F9 box number', text: 'What number do I give Noon?', checks: { out: out('box_number'), number: has('507') } },
  { id: 'F13 box status', text: 'is my box ok? anything inside?', checks: { out: out('box_status'), battery: has('battery') } },
  { id: 'F14 guest code', text: 'send me a code for my cleaner', checks: { code: has('482913'), otp: (r) => r.otpIssued === true, apiBox: () => stubs.code.length === 1 && !stubs.code[0].deliveryId } },
  { id: 'F15 replacement code', text: "the driver says the code doesn't work for NQ4455667788", checks: { code: has('482913'), forRef: has('NQ4455667788'), linked: () => Boolean(stubs.code[0]?.deliveryId) } },
  { id: 'F16 report issue', text: "the box has a red light and won't open", checks: { ticket: has('T-1'), sent: () => stubs.report.length === 1 } },
  { id: 'F16 duplicate report', text: 'the box has a red light and it will not open at all', checks: { noSecondTicket: () => stubs.report.length === 0 } },
  { id: 'F17 STOP', text: 'STOP', checks: { out: out('preferences_optOut'), api: () => stubs.prefs[0]?.whatsappOptOut === true } },
  { id: 'F17 START', text: 'START', checks: { api: () => stubs.prefs[0]?.whatsappOptOut === false } },
  { id: 'F17 no driver calls', text: "I don't want drivers to call me", checks: { api: () => stubs.prefs[0]?.allowDriverContact === false, notCancel: (r) => !/cancel/.test(r.outcome) } },
  { id: 'F18 account change', text: 'please delete my account', checks: { ticket: has('T-'), category: () => stubs.report[0]?.category === 'other' } },
  { id: 'F19 theft', text: 'my parcel was stolen from the box', checks: { advice: has('stolen'), ticket: () => stubs.report.length === 1 } },
  { id: 'F4 self driver escape', text: 'I am the driver delivering to this box', checks: { owner: (r) => r.actor === 'customer', neverDriver: (r) => r.outcome === 'owner_never_driver', wording: has('registered as a box owner') } },
  { id: 'F5 wat can you do', text: 'wat can you do', checks: { menu: has('1. Register') } },
  { id: 'F3 Arabic greeting', text: 'مرحبا', checks: { arabic: (r) => AR_RX.test(r.reply.split('\n')[0]), out: out('owner_greeting') } },
  { id: 'F7 Arabic list', text: 'وش جاي هالأسبوع', checks: { out: outIn('listed', 'list_empty'), arabic: (r) => AR_RX.test(r.reply.split('\n')[0]) } },
  { id: 'thanks', text: 'thanks!', checks: { out: out('thanks') } },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await TurnState.updateOne({ phoneDigits: digitsOnly(OWNER) }, { $unset: { ownerSlot: 1, lastTicket: 1, pendingIssue: 1 } });
  const results = [];
  for (const sc of SCENARIOS) {
    for (const k of Object.keys(stubs)) stubs[k].length = 0;
    const r = await turnService.handle({ phone: OWNER, text: sc.text });
    const failed = Object.entries(sc.checks)
      .filter(([, fn]) => {
        try {
          return !fn(r);
        } catch (e) {
          return true;
        }
      })
      .map(([name]) => name);
    results.push({ id: sc.id, text: sc.text, pass: !failed.length, failed, outcome: r.outcome, reply: r.reply });
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const { status, data } = await llboxService.listDeliveries(OWNER, { reference: REF(c), include_finished: false });
    for (const d of status === 200 ? data.deliveries || [] : []) {
      if (d.can_cancel) await llboxService.cancelDelivery(OWNER, d.delivery_id);
    }
  }

  for (const res of results) {
    console.log(`\n#${res.id} ${res.pass ? 'PASS' : 'FAIL ' + res.failed.join(',')} | outcome=${res.outcome}\n   >>> ${res.text}`);
    console.log(res.reply.replace(/\b\d{6}\b/g, '******').split('\n').map((l) => `   ${l}`).join('\n'));
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passed}/${results.length} owner checks passed ===`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ suite: 'owner', passed, total: results.length, results }, null, 2));
  await TurnState.updateOne({ phoneDigits: digitsOnly(OWNER) }, { $unset: { ownerSlot: 1, lastTicket: 1 } });
  await mongoose.disconnect();
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
