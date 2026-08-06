/**
 * Socket.io Service
 * Handles real-time communication for synchronized sessions (Extension 1)
 *
 * Sockets carry room membership and *outbound* broadcasts only. Every mutation
 * (advance, previous, activity, chat, quiz start, end) goes through the REST
 * controllers in session.controller.js, which then call emitToSession(). That
 * keeps one authoritative copy of each rule — ownership checks, validation,
 * bounds — instead of the same logic written twice and drifting.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Session = require('../models/Session');

let io = null;

/**
 * Activities store only a participantId, but the teacher's panel renders a name
 * per row. Live activities carry the username in the event (see
 * session.controller.logActivity); the backlog replayed on join has to resolve
 * it from the participant list instead.
 */
function withUsernames(session) {
  const names = new Map(
    session.participants.map((p) => [p.userId.toString(), p.username])
  );
  return session.activities.map((a) => ({
    participantId: a.participantId,
    action: a.action,
    timestamp: a.timestamp,
    username: names.get(a.participantId.toString()) || 'Sconosciuto',
  }));
}

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

        /* The full catch-up state. A client that reloads or joins late rebuilds
         * its whole session view from this one event — current stop, who's here,
         * the chat backlog, the activity log and whether the quiz is already
         * running — so it never has to re-fetch after connecting. */
        socket.emit('session:state', {
          currentItemIndex: session.currentItemIndex,
          participants: session.participants,
          participantCount: session.participants.filter((p) => p.isActive).length,
          messages: session.messages,
          activities: withUsernames(session),
          quizStarted: session.quizStarted,
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