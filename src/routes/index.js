/**
 * API Routes aggregator
 * Combines all route modules under /api prefix
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const museumRoutes = require('./museum.routes');
const itemRoutes = require('./item.routes');
const visitRoutes = require('./visit.routes');
const sessionRoutes = require('./session.routes');
// const aiRoutes = require('./ai.routes'); // TODO: Implement AI routes

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/museums', museumRoutes);
router.use('/items', itemRoutes);
router.use('/visits', visitRoutes);
router.use('/sessions', sessionRoutes);
// router.use('/ai', aiRoutes); // TODO: Uncomment when AI routes are implemented

module.exports = router;
