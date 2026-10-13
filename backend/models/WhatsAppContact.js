const mongoose = require('mongoose');

const whatsAppContactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    phoneDigits: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    awaitingName: {
      type: Boolean,
      default: false,
    },
    lastIntent: {
      type: String,
      default: '',
    },
    lastOrderReference: {
      type: String,
      default: '',
    },
    lastInboundText: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
    },
    source: {
      type: String,
      default: 'whatsapp',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppContact', whatsAppContactSchema);
