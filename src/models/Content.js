/**
 * Content Model
 * Represents a base entity (artwork, artist, movement) in a museum
 */

const mongoose = require('mongoose');
const contentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Artwork', 'Artist', 'Movement', 'Place'],
      required: [true, 'Content type is required'],
    },
    museumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Museum',
      required: [true, 'Museum reference is required'],
    },
    universalId: {    // Stable external ID, used by Item.contentId for linking
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    name: {
      type: String,
      required: [true, 'Content name is required'],
      trim: true,
    },
    author: {
      type: String,
      trim: true,
    },
    year: {
      type: String,
      trim: true,
    },
    imageRecognitionUrl: {
      type: String,
    },
    // Geo-referenced coordinates for the item location
    coordinates: {
      lat: Number,
      lng: Number,
    },
    // QR code data for positioning
    qrCode: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
contentSchema.index({ museumId: 1, type: 1 });
contentSchema.index({ universalId: 1 });

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
