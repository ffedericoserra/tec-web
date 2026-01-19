/**
 * RawContent Model
 * Represents a base entity (artwork, artist, movement) in a museum
 */

const mongoose = require('mongoose');

const rawContentSchema = new mongoose.Schema(
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
    universalId: {
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
rawContentSchema.index({ museumId: 1, type: 1 });
rawContentSchema.index({ universalId: 1 });

const RawContent = mongoose.model('RawContent', rawContentSchema);

module.exports = RawContent;