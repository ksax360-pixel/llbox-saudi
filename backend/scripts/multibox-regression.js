#!/usr/bin/env node
/**
 * Owner with two boxes (Test Report 2026-10-04 F8) plus R4 wording checks. LLBox's QA owner has one box,
 * so identify and the owner endpoints are stubbed here. Usage: node scripts/multibox-regression.js [--json=out.json]
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const mongoose = require('mongoose');
const llboxService = require('../services/llbox.service');
const journeyService = require('../services/journey.service');
const followUpService = require('../services/followup.service');
const turnService = require('../services/turn.service');
const TurnState = require('../models/TurnState');

const JSON_OUT = (process.argv.find((a) => a.startsWith('--json=')) || '').split('=')[1];
const calls = { register: [], code: [], report: [] };
const OWNER = `+1997${String(Date.now()).slice(-6)}`;
const DRIVER = `+1996${String(Date.now()).slice(-6)}`;

llboxService.identifyWhatsapp = async (phone) =>
  phone === OWNER
    ? {
        userFound: true,
        recipientName: 'Huda',
        boxes: [
          { boxId: 11, boxCode: 'BOX-11', nickname: 'Home villa', status: 'available', health: 'ok' },
          { boxId: 12, boxCode: 'BOX-12', nickname: 'Office', status: 'available', health: 'ok' },
        ],
        preferences: { whatsappOptOut: false, allowDriverContact: true },
        availableActions: ['register_delivery', 'list_deliveries', 'cancel_delivery', 'get_code', 'box_status'],
        activeDeliveries: 2,
        parcelAwaitingCollection: false,
        summary: 'You have 2 deliveries on the way.',
      }
    : { userFound: false, boxes: [] };
journeyService.handleWhatsappRegistration = async (args) => {
  calls.register.push(args);
  return { success: true, orderReference: args.orderReference, expectedDeliveryDate: args.expectedDeliveryDate || '2026-10-08', boxId: args.boxId };
};
llboxService.issueCode = async (phone, args) => {
  calls.code.push(args);
  return { status: 200, data: { code: '551177', expires_at: new Date(Date.now() + 3600e3).toISOString() } };
};
llboxService.reportIssue = async (phone, args) => {
  calls.report.push(args);
  return { status: 201, data: { ticket_id: 'T-77' } };
};
journeyService.handleDriverVerification = async (ref) => ({
  success: true,
  orderReference: ref,
  sayByLanguage: { en: `HANDOVER ${ref}`, ar: `تسليم ${ref}` },
  boxPhotos: [],
});
followUpService.scheduleDeliveryStatus = async () => {};

const has = (s) => (r) => r.reply.includes(s);
const AR_RX = /[\u0600-\u06FF]/;
const SCENARIOS = [
  { id: 'F8 register asks box', phone: OWNER, text: 'register ABC123456 tomorrow', checks: { asks: (r) => r.outcome === 'ask_box', lists: (r) => has('Home villa')(r) && has('Office')(r), notYet: () => calls.register.length === 0 } },
  { id: 'F8 box by name', phone: OWNER, text: 'the office one', checks: { registered: (r) => r.outcome === 'registered', box: () => calls.register[0]?.boxId === 12 } },
  { id: 'F8 box by number', phone: OWNER, text: 'register XYZ998877 for Sunday', checks: { asks: (r) => r.outcome === 'ask_box' } },
  { id: 'F8 box by number answer', phone: OWNER, text: '1', checks: { box: () => calls.register[0]?.boxId === 11 } },
  { id: 'F8 box named up front', phone: OWNER, text: 'register QWE445566 at home tomorrow', checks: { noAsk: (r) => r.outcome === 'registered', box: () => calls.register[0]?.boxId === 11 } },
  { id: 'F8 guest code asks box', phone: OWNER, text: 'send me a code for my cleaner', checks: { asks: (r) => r.outcome === 'ask_box' } },
  { id: 'F8 guest code office', phone: OWNER, text: 'office', checks: { box: () => calls.code[0]?.boxId === 12 } },
  { id: 'F8 report asks box', phone: OWNER, text: "the box has a red light and won't open", checks: { asks: (r) => r.outcome === 'ask_box' } },
  { id: 'F8 report home', phone: OWNER, text: '1', checks: { box: () => calls.report[0]?.boxId === 11, ticket: has('T-77') } },
  { id: 'R4 Urdu script', phone: DRIVER, text: 'میرے پاس پارسل ہے، باکس کہاں ہے؟', checks: { arabicScript: (r) => AR_RX.test(r.reply), asksRef: (r) => r.outcome === 'ask_reference' || r.outcome === 'fallback' } },
  { id: 'R4 spaced form same driver', phone: DRIVER, text: 'spl 88 123456', checks: { handover: has('HANDOVER') } },
  { id: 'R4 same ref compact', phone: DRIVER, text: 'SPL88123456', checks: { noOtherDriver: (r) => !/another driver/i.test(r.reply) } },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const results = [];
  for (const sc of SCENARIOS) {
    for (const k of Object.keys(calls)) calls[k].length = 0;
    const r = await turnService.handle({ phone: sc.phone, text: sc.text });
    const failed = Object.entries(sc.checks).filter(([, fn]) => {
      try {
        return !fn(r);
      } catch (e) {
        return true;
      }
    }).map(([n]) => n);
    results.push({ id: sc.id, text: sc.text, pass: !failed.length, failed, outcome: r.outcome, reply: r.reply });
    await new Promise((resolve) => setTimeout(resolve, 5200));
  }
  for (const res of results) {
    console.log(`\n#${res.id} ${res.pass ? 'PASS' : 'FAIL ' + res.failed.join(',')} | outcome=${res.outcome}\n   >>> ${res.text}`);
    console.log(res.reply.split('\n').map((l) => `   ${l}`).join('\n'));
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== ${passed}/${results.length} multi-box / R4 checks passed ===`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ suite: 'multibox', passed, total: results.length, results }, null, 2));
  await TurnState.deleteMany({ phoneDigits: { $regex: '^199[67]' } });
  await mongoose.disconnect();
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
