const mongoose = require('mongoose');
const { CALL_STATUS } = require('../utils/constants');

const callLogSchema = new mongoose.Schema(
  {
    incomingNumber: {
      type: String,
      required: [true, 'Incoming number is required'],
      trim: true,
      index: true,
    },
    twilioCallSid: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    elevenLabsConversationId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CALL_STATUS),
      default: CALL_STATUS.RINGING,
      index: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    recordingUrl: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'inbound',
    },
    notes: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

callLogSchema.index({ startedAt: -1 });
callLogSchema.index({ status: 1, startedAt: -1 });

module.exports = mongoose.model('CallLog', callLogSchema);
