/**
 * ArtAround Backend Entry Point
 * Express server with MongoDB connection
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const env = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socketService');

const runSeed = require('../scripts/seed');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Marketplace frontend (vanilla HTML/CSS/JS)
const marketplaceDir = path.join(__dirname, '..', 'frontend-marketplace');
app.use('/marketplace/css', express.static(path.join(marketplaceDir, 'css')));
app.use('/marketplace/js', express.static(path.join(marketplaceDir, 'js')));
app.use('/marketplace/assets', express.static(path.join(marketplaceDir, 'assets')));
app.get('/marketplace', (req, res) => {
  res.sendFile(path.join(marketplaceDir, 'pages', 'home.html'));
});
app.get('/marketplace/museums', (req, res) => {
  res.sendFile(path.join(marketplaceDir, 'pages', 'museums.html'));
});
app.get('/marketplace/museums/:slug', (req, res) => {
  res.sendFile(path.join(marketplaceDir, 'pages', 'museum.html'));
});

// API routes
app.use('/api', apiRoutes);

// Navigator frontend (React SPA, Vite-built). Mounted last so it doesn't
// shadow /api, /marketplace, or /uploads. The catch-all only matches paths
// without a file extension so missing assets still 404 instead of returning
// HTML.
const navigatorDir = path.join(__dirname, '..', 'frontend-navigator', 'dist');
app.use(express.static(navigatorDir));
app.get(/^\/(?!api|marketplace|uploads)[^.]*$/, (req, res) => {
  res.sendFile(path.join(navigatorDir, 'index.html'));
});

// Error handling
app.use(errorHandler);

// Initialize Socket.io
initSocket(server);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    // Seeding mongo with sample data;
    await runSeed();

    server.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
