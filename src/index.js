/**
 * ArtAround Backend Entry Point
 * Express server with MongoDB connection
 */

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path'); //aggiunto per il deploy
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

//per deploy
// Dice a Express di servire i file statici della cartella frontend-marketplace
app.use('/frontend/marketplace', express.static(path.join(__dirname, '../frontend/marketplace')));
// Facoltativo: se l'utente va sulla root del sito, rimandalo alla homepage
app.get('/', (req, res) => {
    res.redirect('/frontend/marketplace/pages/homepage.html');
});


// API routes
app.use('/api', apiRoutes);

// Navigator frontend (React SPA, Vite-built into frontend-navigator/dist).
// Mounted after /api so it doesn't shadow API routes. The catch-all only
// matches paths without a file extension so missing assets still 404 instead
// of returning HTML. The earlier `app.get('/')` redirect to the marketplace
// homepage stays first, so the navigator owns every other extensionless path.
const navigatorDir = path.join(__dirname, '..', 'frontend-navigator', 'dist');
app.use(express.static(navigatorDir));
app.get(/^\/(?!api|frontend|uploads)[^.]*$/, (req, res) => {
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
