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

    console.log("DATI RICEVUTI DA EXPRESS:", req.body);//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    // 1. Aggiungiamo l'email ai dati ricevuti dal frontend
    const { username, email, password } = req.body;

    // 2. Controllo sicurezza: verifichiamo che i campi non siano vuoti
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    // 3. Controlliamo se esiste già un utente con lo STESSO username o la STESSA email
    const existingUser = await User.findOne({ 
        $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // 4. Creiamo l'utente passandogli anche l'email
    const user = new User({ username, email, password });
    await user.save();

    // 5. Generiamo il token (esattamente come lo avevi scritto tu)
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

    // Cerca un utente in cui il campo "username" O il campo "email"
    // corrisponda al testo inserito dall'utente nel form di login
    const user = await User.findOne({ 
        $or: [
            { username: username }, 
            { email: username }
        ] 
    });

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
      { expiresIn: env.JWT_EXPIRES_IN }
    );

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