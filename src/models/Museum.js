/**
 * Museum Model
 * Represents a museum with its configuration and points of interest
 */

const mongoose = require('mongoose');

const openingHoursSchema = new mongoose.Schema(
  {
    mon: { type: String, default: 'Chiuso' },
    tue: { type: String, default: 'Chiuso' },
    wed: { type: String, default: 'Chiuso' },
    thu: { type: String, default: 'Chiuso' },
    fri: { type: String, default: 'Chiuso' },
    sat: { type: String, default: 'Chiuso' },
    sun: { type: String, default: 'Chiuso' },
  },
  { _id: false }
);

const pointOfInterestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['toilet', 'exit', 'bar', 'stairs', 'entrance', 'shop'],
      required: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    label: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const museumSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Museum name is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    address: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    openingHours: {
      type: openingHoursSchema,
      default: () => ({}),
    },
    mapData: {      // Refine when testing with actual maps
      imageUrl: String,
      // For geo-referenced maps (lat/lng)
      bounds: {
        north: Number,
        south: Number,
        east: Number,
        west: Number,
      },
      // Center coordinates for the museum
      center: {
        lat: Number,
        lng: Number,
      },
    },
    pointsOfInterest: [pointOfInterestSchema],
    imageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '')    // Remove special chars
    .trim()
    .replace(/\s+/g, '-')            // Spaces to hyphens
    .replace(/-+/g, '-');            // Multiple hyphens to single
}

// Auto-generate slug before save
museumSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = generateSlug(this.name);
  }
  next();
});

// Find by slug or ID
museumSchema.statics.findBySlugOrId = function (identifier) {
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return this.findById(identifier);
  }
  return this.findOne({ slug: identifier });
};

const Museum = mongoose.model('Museum', museumSchema);

module.exports = Museum;
