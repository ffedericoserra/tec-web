/**
 * Session Model
 * Represents a synchronized visit session (teacher + students)
 */

const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /**
     * The navigator logs the id of the controlled-vocabulary command a student
     * issued (see frontend-navigator/src/voice.js), so the teacher's Activities
     * panel can label it with the same wording the student saw. 'joined' and
     * 'left' are written by the server itself; 'tellLess' and 'tooSimple' are
     * legacy values with no UI, kept so old sessions still validate.
     */
    action: {
      type: String,
      enum: [
        'joined',
        'left',
        'more',
        'simpler',
        'author',
        'year',
        'exit',
        'map',
        'tellMore',
        'tellLess',
        'tooSimple',
      ],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const quizAnswerSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
    },
    selectedIndex: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Chat is persisted rather than kept in the socket room so a student who
 * reloads, or joins late, still sees the backlog. `username` is denormalised
 * for the same reason it is on participantSchema: the panel renders a name per
 * line and populating a ref per message is not worth it.
 */
const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: String,
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    quizAnswers: [quizAnswerSchema],
    quizScore: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    visitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visit',
      required: true,
    },
    participants: [participantSchema],
    currentItemIndex: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activities: [activitySchema],
    messages: [messageSchema],

    /**
     * Flipped by the teacher's "Start Quiz" on the last stop. Persisted rather
     * than left as a socket-only signal so a student who reloads mid-quiz lands
     * back on the quiz instead of the last artwork.
     */
    quizStarted: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
sessionSchema.index({ code: 1 });
sessionSchema.index({ owner: 1, isActive: 1 });
sessionSchema.index({ visitId: 1 });

// Generate a mnemonic session code (used as fallback when no custom name is provided)
sessionSchema.statics.generateCode = function () {
  const adjectives = ['ROSSO', 'BLU', 'VERDE', 'GIALLO', 'VIOLA', 'ARANCIO'];
  const nouns = ['LEONE', 'AQUILA', 'TIGRE', 'LUPO', 'FALCO', 'ORSO'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}_${noun}_${num}`;
};

// Find active session by code
sessionSchema.statics.findActiveByCode = function (code) {
  return this.findOne({ code: code.toUpperCase(), isActive: true });
};

// Virtual for participant count
sessionSchema.virtual('participantCount').get(function () {
  return this.participants.filter((p) => p.isActive).length;
});

sessionSchema.set('toJSON', { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;