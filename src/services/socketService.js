/**
 * Socket.io Service
 * Handles real-time communication for synchronized sessions (Extension 1)
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Session = require('../models/Session');

let io = null;

/**
 * Initialize Socket.io server
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId}`);

    // Join a session room
    socket.on('session:join', async (code) => {
      try {
        const session = await Session.findActiveByCode(code);
        if (!session) {
          socket.emit('session:error', 'Session not found');
          return;
        }

        socket.join(`session:${code}`);
        socket.sessionCode = code;

        // Notify others
        socket.to(`session:${code}`).emit('session:participant-joined', {
          userId: socket.userId,
          username: socket.username,
        });

        // Send current state
        socket.emit('session:state', {
          currentItemIndex: session.currentItemIndex,
          participantCount: session.participants.filter((p) => p.isActive).length,
        });
      } catch (err) {
        socket.emit('session:error', err.message);
      }
    });

    // Leave session room
    socket.on('session:leave', () => {
      if (socket.sessionCode) {
        socket.to(`session:${socket.sessionCode}`).emit('session:participant-left', {
          userId: socket.userId,
          username: socket.username,
        });
        socket.leave(`session:${socket.sessionCode}`);
        socket.sessionCode = null;
      }
    });

    // Teacher advances item
    socket.on('session:advance', async (code) => {
      try {
        const session = await Session.findActiveByCode(code).populate('visitId', 'sequence');
        if (!session) return;

        // Only owner can advance
        if (session.owner.toString() !== socket.userId) return;

        const maxIndex = session.visitId.sequence.length - 1;
        if (session.currentItemIndex < maxIndex) {
          session.currentItemIndex += 1;
          await session.save();
        }

        // Broadcast to all in session
        io.to(`session:${code}`).emit('session:item-changed', {
          currentItemIndex: session.currentItemIndex,
          isLast: session.currentItemIndex >= maxIndex,
        });
      } catch (err) {
        socket.emit('session:error', err.message);
      }
    });

    // Teacher goes to previous
    socket.on('session:previous', async (code) => {
      try {
        const session = await Session.findActiveByCode(code);
        if (!session) return;

        if (session.owner.toString() !== socket.userId) return;

        if (session.currentItemIndex > 0) {
          session.currentItemIndex -= 1;
          await session.save();
        }

        io.to(`session:${code}`).emit('session:item-changed', {
          currentItemIndex: session.currentItemIndex,
          isFirst: session.currentItemIndex === 0,
        });
      } catch (err) {
        socket.emit('session:error', err.message);
      }
    });

    // Participant activity (logged and sent to teacher)
    socket.on('session:activity', async ({ code, action }) => {
      try {
        const session = await Session.findActiveByCode(code);
        if (!session) return;

        session.activities.push({
          participantId: socket.userId,
          action,
        });
        await session.save();

        // Notify teacher
        io.to(`session:${code}`).emit('session:activity', {
          userId: socket.userId,
          username: socket.username,
          action,
          timestamp: new Date(),
        });
      } catch (err) {
        socket.emit('session:error', err.message);
      }
    });

    // End session
    socket.on('session:end', async (code) => {
      try {
        const session = await Session.findActiveByCode(code);
        if (!session) return;

        if (session.owner.toString() !== socket.userId) return;

        session.isActive = false;
        session.endedAt = new Date();
        await session.save();

        io.to(`session:${code}`).emit('session:ended');
      } catch (err) {
        socket.emit('session:error', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.userId}`);
      if (socket.sessionCode) {
        socket.to(`session:${socket.sessionCode}`).emit('session:participant-left', {
          userId: socket.userId,
          username: socket.username,
        });
      }
    });
  });

  return io;
}

/**
 * Get Socket.io instance
 */
function getIO() {
  return io;
}

/**
 * Emit to a session room
 */
function emitToSession(code, event, data) {
  if (io) {
    io.to(`session:${code}`).emit(event, data);
  }
}

module.exports = { initSocket, getIO, emitToSession };