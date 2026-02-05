/**
 * Authentication Controller
 * Handles user registration, login, and profile
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

/**
 * Register a new user
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Create user
    const user = new User({ username, password });
    await user.save();

    // Generate token
    const token = jwt.sign(
        { userId: user._id },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN });

    res.json({
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('savedMuseums', 'name imageUrl')
      .populate('myVisits', 'title museumId');

    res.json({ user });
  } catch (error) {
    next(error);
  }
};