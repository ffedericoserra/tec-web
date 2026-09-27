/**
 * Item routes
 * GET /api/items - List items (filter by contentId, creatorId, isPublic)
 * GET /api/items/:id - Get item with descriptions
 * POST /api/items - Create new item
 * PUT /api/items/:id - Update item
 * DELETE /api/items/:id - Delete item
 * POST /api/items/:id/purchase - Purchase item from marketplace
 */

const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createItemSchema, updateItemSchema } = require('../schemas/item.schema');

router.get('/', optionalAuth, itemController.list);
router.get('/:id', optionalAuth, itemController.getById);
router.post('/', requireAuth, validate(createItemSchema), itemController.create);
router.put('/:id', requireAuth, validate(updateItemSchema), itemController.update);
router.delete('/:id', requireAuth, itemController.remove);
router.post('/:id/purchase', requireAuth, itemController.purchase);

module.exports = router;
