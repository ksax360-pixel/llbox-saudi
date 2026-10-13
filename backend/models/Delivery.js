const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      enum: ['registered', 'matched', 'otp_generated', 'locker_opened', 'completed'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    orderReference: { type: String, required: true, unique: true, trim: true, index: true },
    customerName: { type: String, default: '', trim: true },
    customerMobile: { type: String, default: '', trim: true, index: true },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    vendor: { type: String, default: 'LLBox' },
    lockerBoxId: { type: Number },
    lockerCode: { type: String, default: '' },
    sessionId: { type: String, default: '' },
    otpStatus: {
      type: String,
      enum: ['pending', 'sent', 'verified', 'expired'],
      default: 'pending',
    },
    lastOtp: { type: String, default: '' },
    otpExpiresAt: { type: Date },
    lastAddress: { type: String, default: '' },
    lastGoogleMaps: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'matched', 'completed', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    city: { type: String, default: 'Riyadh' },
    timeline: { type: [timelineSchema], default: [] },
    source: { type: String, default: 'llbox' },
  },
  { timestamps: true }
);

deliverySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Delivery', deliverySchema);
