/**
 * Session Routes (Extension 1 - Synchronized Mode)
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createSessionSchema,
  logActivitySchema,
  sendMessageSchema,
  submitQuizSchema,
  submitSectionAnswerSchema,
} = require('../schemas/session.schema');

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
router.post('/:code/message', validate(sendMessageSchema), sessionController.sendMessage);
router.post(
  '/:code/sections/:sectionId/answers',
  validate(submitSectionAnswerSchema),
  sessionController.submitSectionAnswer
);
router.get(
  '/:code/sections/:sectionId/responses',
  sessionController.getSectionResponses
);

// Quiz
router.post('/:code/quiz/start', sessionController.startQuiz);
router.post('/:code/quiz', validate(submitQuizSchema), sessionController.submitQuiz);
router.get('/:code/quiz', sessionController.getQuizResults);

// Teacher actions
router.post('/:code/advance', sessionController.advance);
router.post('/:code/previous', sessionController.previous);
router.post('/:code/end', sessionController.end);

module.exports = router;
