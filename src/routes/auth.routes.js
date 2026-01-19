/**
 * Authentication routes
 * POST /api/auth/register - Create new user
 * POST /api/auth/login - Login and get JWT
 * GET /api/auth/me - Get current user
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/auth.schema');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
