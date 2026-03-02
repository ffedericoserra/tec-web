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
app.use('/frontend-marketplace', express.static(path.join(__dirname, '../frontend-marketplace')));
// Facoltativo: se l'utente va sulla root del sito, rimandalo alla homepage
app.get('/', (req, res) => {
    res.redirect('/frontend-marketplace/homepage.html');
});


// API routes
app.use('/api', apiRoutes);

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
