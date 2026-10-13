#!/usr/bin/env node
/**
 * Owner-mode smoke run against live LLBox as a given owner number (no WhatsApp is sent).
 * Usage: node scripts/owner-smoke.js "+966571099035" "hi" "menu" "2" ...
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const turnService = require('../services/turn.service');

(async () => {
  const [phone, ...messages] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGODB_URI);
  for (const text of messages) {
    const r = await turnService.handle({ phone, text });
    console.log(`\n>>> ${text}\n[${r.outcome}] actor=${r.actor}`);
    console.log(r.reply.split('\n').map((l) => `   ${l}`).join('\n'));
    await new Promise((resolve) => setTimeout(resolve, 5500));
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
