const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
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

// language_override must not use our app `language` field (values like `ar` are not Mongo text languages)
knowledgeSchema.index(
  { title: 'text', content: 'text', tags: 'text' },
  { default_language: 'none', language_override: 'unused_text_language' }
);
knowledgeSchema.index({ category: 1, isPublished: 1 });

module.exports = mongoose.model('Knowledge', knowledgeSchema);
