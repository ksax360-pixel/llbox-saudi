const mongoose = require('mongoose');
const { SETTING_CATEGORIES } = require('../utils/constants');

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Setting key is required'],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(SETTING_CATEGORIES),
      required: [true, 'Setting category is required'],
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    label: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    isSecret: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

settingSchema.index({ category: 1, key: 1 });

settingSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({ virtuals: false });
  if (obj.isSecret && obj.value !== undefined && obj.value !== null) {
    obj.value = '********';
  }
  return obj;
};

module.exports = mongoose.model('Setting', settingSchema);
