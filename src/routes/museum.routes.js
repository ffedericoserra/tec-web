/**
 * Museum routes
 * GET /api/museums - List all museums
 * GET /api/museums/:id - Get museum details
 * POST /api/museums - Create museum (authenticated)
 * PUT /api/museums/:id - Update museum (authenticated)
 * POST /api/museums/:id/save - Save museum to user's list
 * DELETE /api/museums/:id/save - Remove from saved list
 * GET /api/museums/:id/contents - Get Contents for museum
 * POST /api/museums/:id/contents - Create Content (authenticated)
 */

const express = require('express');
const router = express.Router();
const museumController = require('../controllers/museum.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createMuseumSchema, updateMuseumSchema, createContentSchema } = require('../schemas/museum.schema');
const upload = require('../middleware/upload');

router.get('/', museumController.list);
router.get('/:id', museumController.getById);
router.post('/', requireAuth, validate(createMuseumSchema), museumController.create);
router.put('/:id', requireAuth, validate(updateMuseumSchema), museumController.update);

// User's saved museums
router.post('/:id/save', requireAuth, museumController.saveMuseum);
router.delete('/:id/save', requireAuth, museumController.unsaveMuseum);

// Contents
router.get('/:id/contents', museumController.getContents);
router.post('/:id/contents', requireAuth, validate(createContentSchema), museumController.createContent);

// Image uploads
router.post('/:id/image', requireAuth,
  (req, res, next) => { req.uploadDir = 'uploads/museums'; next(); },
  upload.single('image'),
  museumController.uploadImage
);
router.post('/:id/contents/:contentId/image', requireAuth,
  (req, res, next) => { req.uploadDir = 'uploads/contents'; next(); },
  upload.single('image'),
  museumController.uploadContentImage
);

// Visits for museum (public)
router.get('/:id/visits', optionalAuth, museumController.getVisits);

module.exports = router;
