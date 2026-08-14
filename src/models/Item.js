/**
 * Item Model
 * Represents a personalized presentation of a Content
 * Contains descriptions with different tones and lengths
 */

const mongoose = require('mongoose');

const textSchema = new mongoose.Schema(
  {
    text: {
        type: String,
        required: [true, 'Description text is required'],
    },
    lengthCategory: {
        type: String,
        enum: ['3s', '15s', '45s'],
        required: true,
    },
    language: {
        type: String,
        enum: ['it', 'en', 'fr', 'de', 'es'],
        default: 'it',
    },
    // For AI fallback: pre-generated content
    isAiGenerated: {
        type: Boolean,
        default: false,
    },
  },
  { _id: false }
);

const descriptionSchema = new mongoose.Schema(
  {
    tone: {
        type: String,
        enum: ['easy', 'medium', 'complex'],
        required: true,
    },
    texts: [textSchema],
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    // Links to Content.universalId
    contentId: {
      type: String,
      required: [true, 'Content reference is required'],
      trim: true,
      immutable: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    targetAudience: {
        type: String,
        enum: ['general', 'children', 'student', 'expert', 'tourist'],
        trim: true,
        required: [true, 'Target audience description is required'],
    },
    descriptions: [descriptionSchema],

    // Marketplace properties
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    license: {
      type: String,
      enum: ['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'Copyright', 'Public Domain'],
      default: 'CC-BY',
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    salesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Related content (artist, movement, etc.)
    associatedContents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
itemSchema.index({ contentId: 1 });
itemSchema.index({ creatorId: 1 });
itemSchema.index({ isPublic: 1 });

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
