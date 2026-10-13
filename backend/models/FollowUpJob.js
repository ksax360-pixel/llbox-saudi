const mongoose = require('mongoose');

/**
 * Background follow-ups after a turn has ended (LLBox has no webhooks):
 *  - delivery_status: poll delivery/status after a handover, thank the driver when completed.
 *  - contact_review: poll driver-contact/:id after a 202 pending_review.
 *  - cancelled_arrival: poll cancelled-arrival/:id until the customer answers (or times out).
 *  - arrival_ask: message the owner on WhatsApp about a cancelled arrival and wait for YES/NO.
 * Never holds a customer phone number or a code in delivery_status / contact_review / cancelled_arrival.
 * arrival_ask stores the owner's WhatsApp digits only so we can send them the question.
 */
const followUpJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['delivery_status', 'contact_review', 'cancelled_arrival', 'arrival_ask'],
      required: true,
    },
    phoneDigits: { type: String, required: true },
    ref: { type: String, required: true },
    refKey: { type: String, required: true },
    requestId: { type: String, default: '' },
    conversationId: { type: String, default: '' },
    reason: { type: String, default: '' },
    languages: { type: [String], default: ['en'] },
    ownerNotified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'done', 'expired'], default: 'active', index: true },
    nextAt: { type: Date, required: true, index: true },
    until: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lockedAt: { type: Date },
    result: { type: String, default: '' },
  },
  { timestamps: true }
);

followUpJobSchema.index({ type: 1, phoneDigits: 1, refKey: 1 });
followUpJobSchema.index({ type: 1, requestId: 1 });

module.exports = mongoose.model('FollowUpJob', followUpJobSchema);
