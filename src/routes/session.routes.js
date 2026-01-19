/**
 * Session Routes (Tier 2 - Synchronized Mode)
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createSessionSchema, logActivitySchema } = require('../schemas/session.schema');

// All routes require authentication
router.use(requireAuth);

// Session management
router.post('/', validate(createSessionSchema), sessionController.create);
router.get('/my', sessionController.getMySessions);
router.get('/:code', sessionController.getByCode);

// Participant actions
router.post('/:code/join', sessionController.join);
router.post('/:code/leave', sessionController.leave);
router.post('/:code/activity', validate(logActivitySchema), sessionController.logActivity);

// Teacher actions
router.post('/:code/advance', sessionController.advance);
router.post('/:code/previous', sessionController.previous);
router.post('/:code/end', sessionController.end);

module.exports = router;
