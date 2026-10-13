const mongoose = require('mongoose');

const lockerSchema = new mongoose.Schema(
  {
    boxId: { type: Number, required: true, unique: true, index: true },
    boxCode: { type: String, required: true, trim: true, index: true },
    location: { type: String, default: '', trim: true },
    city: { type: String, default: 'Riyadh', trim: true },
    latitude: { type: Number, default: 24.7136 },
    longitude: { type: Number, default: 46.6753 },
    capacity: { type: Number, default: 24, min: 1 },
    occupancy: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['available', 'in_use', 'maintenance', 'deactivated'],
      default: 'available',
      index: true,
    },
    lastMaintenance: { type: Date },
    organizationId: { type: String, default: 'org-1' },
    googleMaps: { type: String, default: '' },
    rawStatus: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Locker', lockerSchema);
