const mongoose = require('mongoose');

/**
 * Per-phone WhatsApp conversation state for the deterministic turn pipeline.
 * Never holds an OTP: codes are shown once, from the live tool result, and never read back.
 */
const handoverSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true },
    refKey: { type: String, required: true },
    at: { type: Date, default: Date.now },
    address: { type: String, default: '' },
    googleMaps: { type: String, default: '' },
    boxPhotos: { type: Array, default: [] },
  },
  { _id: false }
);

const turnStateSchema = new mongoose.Schema(
  {
    phoneDigits: { type: String, required: true, unique: true, index: true },
    languageMode: { type: [String], default: [] },
    languageAt: { type: Date },
    failedAttempts: { type: Number, default: 0 },
    lastFailedAt: { type: Date },
    pendingIssue: {
      issue: { type: String, default: '' },
      note: { type: String, default: '' },
      ref: { type: String, default: '' },
      step: { type: String, default: '' },
      at: { type: Date },
    },
    // Repeat driver reports for the same reference (box online / parcel fits → second time notify).
    contactRetry: {
      ref: { type: String, default: '' },
      refKey: { type: String, default: '' },
      reason: { type: String, default: '' },
      at: { type: Date },
    },
    pendingRefs: { type: [String], default: [] },
    identity: {
      userFound: { type: Boolean },
      recipientName: { type: String, default: '' },
      boxes: { type: Array, default: [] },
      at: { type: Date },
    },
    // Owner conversation slot: { intent, step, refs, day, boxId, payment, options, at }. Expires.
    ownerSlot: { type: mongoose.Schema.Types.Mixed, default: null },
    lastTicket: {
      category: { type: String, default: '' },
      ticketId: { type: String, default: '' },
      at: { type: Date },
    },
    handovers: { type: [handoverSchema], default: [] },
    lastTemplate: { type: String, default: '' },
    lastTextHash: { type: String, default: '' },
    lastTextAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TurnState', turnStateSchema);
