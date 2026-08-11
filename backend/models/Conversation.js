const mongoose = require('mongoose');

const toolCallSchema = new mongoose.Schema(
  {
    toolName: { type: String, required: true },
    input: { type: mongoose.Schema.Types.Mixed },
    output: { type: mongoose.Schema.Types.Mixed },
    success: { type: Boolean, default: true },
    calledAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    callerNumber: {
      type: String,
      required: [true, 'Caller number is required'],
      trim: true,
      index: true,
    },
    transcript: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
    },
    intent: {
      type: String,
      trim: true,
      default: '',
    },
    toolCalls: {
      type: [toolCallSchema],
      default: [],
    },
    response: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'failed', 'abandoned'],
      default: 'completed',
    },
    callLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CallLog',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

conversationSchema.index({ intent: 1 });
conversationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
