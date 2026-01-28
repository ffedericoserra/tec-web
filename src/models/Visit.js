/**
 * Visit Model
 * Represents an ordered sequence of Items forming a museum tour
 */

const mongoose = require('mongoose');

const sequenceItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    nextDirections: {
      type: String,
      default: '',
    },
    prevDirections: {
      type: String,
      default: '',
    },
    overrideImage: {
      type: String,
    },
  },
  { _id: false }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    options: [String],
    correctIndex: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const visitSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Visit title is required'],
      trim: true,
    },
    slug: {
      type: String,
      index: true,
    },
    museumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Museum',
      required: [true, 'Museum reference is required'],
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
    },
    sequence: [sequenceItemSchema],

    // Preferred description length for this visit
    length: {
      type: String,
      enum: ['quick', 'normal', 'deep'],
      default: 'normal',
    },

    // Tier 2: Synchronized mode
    type: {
      type: String,
      enum: ['standard', 'synchronized'],
      default: 'standard',
    },
    sessionCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    quiz: [quizQuestionSchema],

    // Visibility
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Stats
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
visitSchema.index({ museumId: 1, isPublic: 1 });
visitSchema.index({ creatorId: 1 });
visitSchema.index({ sessionCode: 1 });

// Virtual for item count
visitSchema.virtual('itemCount').get(function () {
  return this.sequence ? this.sequence.length : 0;
});

// Ensure virtuals are included in JSON
visitSchema.set('toJSON', { virtuals: true });
visitSchema.set('toObject', { virtuals: true });

// Generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Auto-generate slug before save
visitSchema.pre('save', function (next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = generateSlug(this.title);
  }
  next();
});

// Find by slug or ID
visitSchema.statics.findBySlugOrId = function (identifier) {
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return this.findById(identifier);
  }
  return this.findOne({ slug: identifier });
};

const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;