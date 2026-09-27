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
const {
  registerSchema,
  loginSchema,
  rechargeWalletSchema,
  updateLanguageSchema,
} = require('../schemas/auth.schema');



router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', requireAuth, authController.getMe);
router.patch('/language', requireAuth, validate(updateLanguageSchema), authController.updateLanguage);
router.patch('/wallet', requireAuth, validate(rechargeWalletSchema), authController.rechargeWallet);
router.post('/favorites/visits/:visitId', requireAuth, authController.toggleFavoriteVisit);
module.exports = router;
