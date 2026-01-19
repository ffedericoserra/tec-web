/**
 * Visit routes
 * GET /api/visits/my - Get user's own visits
 * GET /api/visits/:id - Get visit with populated items
 * POST /api/visits - Create new visit
 * PUT /api/visits/:id - Update visit
 * DELETE /api/visits/:id - Delete visit
 */

const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visit.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createVisitSchema, updateVisitSchema } = require('../schemas/visit.schema');

router.get('/my', requireAuth, visitController.getMyVisits);
router.get('/:id', visitController.getById);
router.post('/', requireAuth, validate(createVisitSchema), visitController.create);
router.put('/:id', requireAuth, validate(updateVisitSchema), visitController.update);
router.delete('/:id', requireAuth, visitController.remove);

module.exports = router;
