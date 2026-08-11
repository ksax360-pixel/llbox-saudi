const mongoose = require('mongoose');
const { PROMPT_TYPES } = require('../utils/constants');

const promptSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Prompt name is required'],
      trim: true,
      maxlength: 120,
    },
    type: {
      type: String,
      enum: Object.values(PROMPT_TYPES),
      required: [true, 'Prompt type is required'],
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Prompt content is required'],
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    description: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

promptSchema.index({ type: 1, language: 1, isActive: 1 });

module.exports = mongoose.model('Prompt', promptSchema);
