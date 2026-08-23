/**
 * Session socket helper — the real-time half of a group visit (Extension 1).
 *
 * The server treats sockets as broadcast-only: every mutation goes through the
 * REST endpoints in `src/api.js` and the server echoes the result to the room.
 * So this module only ever *connects, joins a room and listens*. If you find
 * yourself wanting a socket.emit() for something that changes state, add a REST
 * call instead — the ownership and bounds checks live there.
 */

import { io } from 'socket.io-client';
import { getToken } from './api.js';

/** Activity actions worth showing the teacher, labelled as the student saw them. */
export const ACTIVITY_LABELS = {
  joined: 'activities.actions.joined',
  left: 'activities.actions.left',
  more: 'activities.actions.more',
  simpler: 'activities.actions.simpler',
  author: 'activities.actions.author',
  year: 'activities.actions.year',
  exit: 'activities.actions.exit',
  map: 'activities.actions.map',
  // Legacy values kept so old sessions still render something sensible.
  tellMore: 'activities.actions.tellMore',
  tellLess: 'activities.actions.tellLess',
  tooSimple: 'activities.actions.tooSimple',
};

/**
 * Connect and join the room for `code`.
 *
 * `handlers` is a map of event name → callback; every key is wired before the
 * join is emitted, so the catch-up `session:state` can't arrive before its
 * listener exists. Returns a disconnect function for the effect cleanup.
 */
export function connectSession(code, handlers = {}) {
  const socket = io({
    // Same origin in both dev (vite proxies /socket.io) and production (Express
    // serves the built app), so there's no URL to configure.
    path: '/socket.io',
    auth: { token: getToken() },
  });

  for (const [event, handler] of Object.entries(handlers)) {
    socket.on(event, handler);
  }

  // Re-join on every connect, not just the first: socket.io transparently
  // reconnects after a network blip, and room membership does not survive it.
  socket.on('connect', () => socket.emit('session:join', code));

  return () => {
    socket.emit('session:leave');
    socket.disconnect();
  };
}
