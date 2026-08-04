/**
 * Session Controller
 * Handles synchronized visit sessions (Extension 1)
 */

const Session = require('../models/Session');
const Visit = require('../models/Visit');
const User = require('../models/User');
const { emitToSession } = require('../services/socketService');

/**
 * Shape a session for the client: tell the caller which role it has, so the
 * navigator doesn't have to compare ObjectIds itself, and hide other people's
 * quiz answers from students. `owner` may or may not be populated depending on
 * the caller, hence the `_id ||` dance.
 */
function presentSession(session, userId) {
  const ownerId = (session.owner?._id || session.owner).toString();
  const me = userId.toString();
  const isOwner = ownerId === me;

  const obj = session.toObject();
  obj.isOwner = isOwner;
  if (!isOwner) {
    obj.participants = obj.participants.map((p) =>
      p.userId.toString() === me
        ? p
        : { ...p, quizAnswers: undefined, quizScore: undefined }
    );
    // Students get the questions and options — never the key. The owner reads
    // the full quiz from GET /sessions/:code/quiz instead.
    if (obj.visitId?.quiz) {
      obj.visitId.quiz = obj.visitId.quiz.map((q) => ({
        question: q.question,
        options: q.options,
      }));
    }
  }
  return obj;
}

/**
 * Create a new session
 * POST /api/sessions
 */
exports.create = async (req, res, next) => {
  try {
    const { visitId } = req.body;

    // Verify visit exists and is synchronized type
    const visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Use custom name if provided, otherwise auto-generate
    let code = req.body.code?.trim().toUpperCase();
    if (!code) {
      let attempts = 0;
      do {
        code = Session.generateCode();
        const existing = await Session.findOne({ code, isActive: true });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);
    } else {
      const existing = await Session.findOne({ code, isActive: true });
      if (existing) {
        return res.status(409).json({ error: 'Session code already in use' });
      }
    }

    const session = new Session({
      code,
      owner: req.user._id,
      visitId,
      participants: [],
      currentItemIndex: 0,
    });
    await session.save();

    // Update user's active session
    await User.findByIdAndUpdate(req.user._id, { activeSession: session._id });

    // Populate for response
    await session.populate('owner', 'username');
    await session.populate({
      path: 'visitId',
      select: 'title description sequence quiz museumId',
      populate: { path: 'museumId', select: 'name slug' },
    });

    res.status(201).json({ session: presentSession(session, req.user._id) });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session by code (for joining)
 * GET /api/sessions/:code
 */
exports.getByCode = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code)
      .populate('owner', 'username')
      .populate({
        path: 'visitId',
        select: 'title description slug sequence quiz museumId',
        // The runner routes by museum slug (it fetches that museum's contents),
        // so the slug has to come along or the client needs a second lookup.
        populate: { path: 'museumId', select: 'name slug' },
      });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    res.json({ session: presentSession(session, req.user._id) });
  } catch (error) {
    next(error);
  }
};

/**
 * Join a session as participant
 * POST /api/sessions/:code/join
 */
exports.join = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    // Check if already a participant
    const existingParticipant = session.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (existingParticipant) {
      // Reactivate if was inactive
      existingParticipant.isActive = true;
    } else {
      // Add new participant
      session.participants.push({
        userId: req.user._id,
        username: req.user.username,
      });

      // Log activity
      session.activities.push({
        participantId: req.user._id,
        action: 'joined',
      });
    }

    await session.save();

    // Update user's active session
    await User.findByIdAndUpdate(req.user._id, { activeSession: session._id });

    await session.populate('owner', 'username');
    await session.populate({
      path: 'visitId',
      select: 'title description slug sequence quiz museumId',
      populate: { path: 'museumId', select: 'name slug' },
    });

    // Tell the room (the teacher's participants panel, mainly) who is in now.
    emitToSession(session.code, 'session:participants', {
      participants: session.participants,
    });

    res.json({ session: presentSession(session, req.user._id) });
  } catch (error) {
    next(error);
  }
};

/**
 * Leave a session
 * POST /api/sessions/:code/leave
 */
exports.leave = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Mark participant as inactive
    const participant = session.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (participant) {
      participant.isActive = false;
      session.activities.push({
        participantId: req.user._id,
        action: 'left',
      });
      await session.save();
      emitToSession(session.code, 'session:participants', {
        participants: session.participants,
      });
    }

    // Clear user's active session
    await User.findByIdAndUpdate(req.user._id, { activeSession: null });

    res.json({ message: 'Left session' });
  } catch (error) {
    next(error);
  }
};

/**
 * Advance to next item (teacher only)
 * POST /api/sessions/:code/advance
 */
exports.advance = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code).populate(
      'visitId',
      'sequence'
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only owner can advance
    if (session.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only session owner can advance' });
    }

    const maxIndex = session.visitId.sequence.length - 1;
    if (session.currentItemIndex < maxIndex) {
      session.currentItemIndex += 1;
      await session.save();
    }

    // The students' runners follow this broadcast; the teacher's own view moves
    // on it too, so both roles stay on exactly the same stop.
    emitToSession(session.code, 'session:item-changed', {
      currentItemIndex: session.currentItemIndex,
      isLast: session.currentItemIndex >= maxIndex,
    });

    res.json({
      currentItemIndex: session.currentItemIndex,
      isLast: session.currentItemIndex >= maxIndex,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Go to previous item (teacher only)
 * POST /api/sessions/:code/previous
 */
exports.previous = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only session owner can navigate' });
    }

    if (session.currentItemIndex > 0) {
      session.currentItemIndex -= 1;
      await session.save();
    }

    emitToSession(session.code, 'session:item-changed', {
      currentItemIndex: session.currentItemIndex,
      isFirst: session.currentItemIndex === 0,
    });

    res.json({
      currentItemIndex: session.currentItemIndex,
      isFirst: session.currentItemIndex === 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log participant activity
 * POST /api/sessions/:code/activity
 */
exports.logActivity = async (req, res, next) => {
  try {
    const { action } = req.body;
    const session = await Session.findActiveByCode(req.params.code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const activity = {
      participantId: req.user._id,
      action,
      timestamp: new Date(),
    };
    session.activities.push(activity);
    await session.save();

    // The teacher's Activities panel is live — it never re-fetches the session.
    // `username` is denormalised into the event for the same reason it is on the
    // participant subdoc: the panel renders a name per row.
    emitToSession(session.code, 'session:activity', {
      ...activity,
      username: req.user.username,
    });

    res.json({ message: 'Activity logged' });
  } catch (error) {
    next(error);
  }
};

/**
 * Post a chat message
 * POST /api/sessions/:code/message
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    const isOwner = session.owner.toString() === req.user._id.toString();
    const isParticipant = session.participants.some(
      (p) => p.userId.toString() === req.user._id.toString()
    );
    if (!isOwner && !isParticipant) {
      return res.status(403).json({ error: 'You are not in this session' });
    }

    const message = {
      userId: req.user._id,
      username: req.user.username,
      text: req.body.text.trim(),
      timestamp: new Date(),
    };
    session.messages.push(message);
    await session.save();

    // Broadcast to the whole room including the sender, so every client appends
    // the message the same way and nobody has to reconcile an optimistic copy.
    emitToSession(session.code, 'session:chat', message);

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};

/**
 * Start the quiz (teacher only)
 * POST /api/sessions/:code/quiz/start
 */
exports.startQuiz = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code).populate(
      'visitId',
      'quiz'
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    if (session.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only session owner can start the quiz' });
    }

    if (!session.visitId?.quiz?.length) {
      return res.status(400).json({ error: 'This visit has no quiz' });
    }

    session.quizStarted = true;
    await session.save();

    emitToSession(session.code, 'session:quiz-started', {});

    res.json({ message: 'Quiz started' });
  } catch (error) {
    next(error);
  }
};

/**
 * End a session (teacher only)
 * POST /api/sessions/:code/end
 */
exports.end = async (req, res, next) => {
  try {
    const session = await Session.findActiveByCode(req.params.code);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only session owner can end' });
    }

    session.isActive = false;
    session.endedAt = new Date();
    await session.save();

    // Sent before the DB fan-out below so students are told promptly; the
    // activeSession cleanup is bookkeeping they don't wait on.
    emitToSession(session.code, 'session:ended', {});

    // Clear active session for all participants
    const participantIds = session.participants.map((p) => p.userId);
    await User.updateMany(
      { _id: { $in: [...participantIds, session.owner] } },
      { activeSession: null }
    );

    res.json({ message: 'Session ended' });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit quiz answers (participant)
 * POST /api/sessions/:code/quiz
 */
exports.submitQuiz = async (req, res, next) => {
  try {
    const { answers } = req.body;
    const session = await Session.findActiveByCode(req.params.code).populate('visitId', 'quiz');

    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    const quiz = session.visitId.quiz;
    if (!quiz || quiz.length === 0) {
      return res.status(400).json({ error: 'This session has no quiz' });
    }

    // Find participant
    const participant = session.participants.find(
      (p) => p.userId.toString() === req.user._id.toString()
    );

    if (!participant) {
      return res.status(403).json({ error: 'You are not a participant of this session' });
    }

    if (participant.quizScore !== null) {
      return res.status(400).json({ error: 'Quiz already submitted' });
    }

    // Score the quiz
    let score = 0;
    for (const answer of answers) {
      const question = quiz[answer.questionIndex];
      if (question && answer.selectedIndex === question.correctIndex) {
        score++;
      }
    }

    participant.quizAnswers = answers;
    participant.quizScore = score;
    await session.save();

    // Drives the teacher's live results panel. Only the score travels — the
    // panel shows a leaderboard, and the answers stay behind the owner-only
    // GET /sessions/:code/quiz.
    emitToSession(session.code, 'session:quiz-submitted', {
      userId: req.user._id,
      username: req.user.username,
      quizScore: score,
      total: quiz.length,
    });

    res.json({
      score,
      total: quiz.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quiz results (owner only)
 * GET /api/sessions/:code/quiz
 */
exports.getQuizResults = async (req, res, next) => {
  try {
    const session = await Session.findOne({ code: req.params.code.toUpperCase() })
      .populate('visitId', 'quiz');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only session owner can view quiz results' });
    }

    const quiz = session.visitId.quiz || [];
    const results = session.participants
      .filter((p) => p.quizScore !== null)
      .map((p) => ({
        userId: p.userId,
        username: p.username,
        quizAnswers: p.quizAnswers,
        quizScore: p.quizScore,
        total: quiz.length,
      }));

    res.json({ results, quiz });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my active sessions (as owner)
 * GET /api/sessions/my
 */
exports.getMySessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ owner: req.user._id })
      .populate('visitId', 'title')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
};