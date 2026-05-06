/**
 * User Model
 * Represents users of both Navigator and Marketplace apps
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    // Manteniamo l'email per la registrazione classica
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'], // Rimesso l'obbligo della password
    },
    savedMuseums: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Museum',
      },
    ],
    myVisits: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Visit',
      },
    ],
    purchasedItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
      },
    ],
    walletBalance: {
      type: Number,
      default: 100,
      min: 0,
    },
    // Extension 1: Synchronized mode
    activeSession: {
      type: String,
      default: null,
    },
    savedVisits: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visit' 
    }],
  },
  {
    timestamps: true,
  }
);

// Virtual setter for raw password
userSchema.virtual('password').set(function (password) {
  this._rawPassword = password;
  this.passwordHash = password; // Will be hashed in pre-save
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this._rawPassword) return next();

  this.passwordHash = await bcrypt.hash(this._rawPassword, 10);
  this._rawPassword = undefined;
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove passwordHash from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;