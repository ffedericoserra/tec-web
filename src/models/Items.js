/**
 * Item Model
 * Represents a personalized presentation of a RawContent
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
        enum: ['3s', '15s', '45s', '2min'],
        required: true,
    },
    language: {
        type: String,
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
    // Links to RawContent.universalId or RawContent._id
    contentId: {
      type: String,
      required: [true, 'Content reference is required'],
    },
    // Reference to RawContent for population
    rawContentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawContent',
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    targetAudience: {
      type: String,
      enum: ['child', 'tourist', 'expert', 'student'],
      default: 'tourist',
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

    // Related content (artist, movement, etc.)
    associatedContents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RawContent',
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