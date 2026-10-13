const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: String, default: '' },
    userName: { type: String, default: 'system' },
    action: { type: String, required: true, trim: true, index: true },
    resource: { type: String, required: true, trim: true, index: true },
    ipAddress: { type: String, default: '' },
    beforeValue: { type: String, default: '' },
    afterValue: { type: String, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
