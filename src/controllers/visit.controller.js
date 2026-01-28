/**
 * Visit Controller
 * Handles visit CRUD operations
 */

const Visit = require('../models/Visit');
const User = require('../models/User');

/**
 * Get user's own visits
 * GET /api/visits/my
 * Query params: museumId
 */
exports.getMyVisits = async (req, res, next) => {
  try {
    const query = { creatorId: req.user._id };

    if (req.query.museumId) {
      query.museumId = req.query.museumId;
    }

    const visits = await Visit.find(query)
      .populate('museumId', 'name')
      .sort({ updatedAt: -1 });

    res.json({ visits });
  } catch (error) {
    next(error);
  }
};

/**
 * Get visit by ID or slug with populated items
 * GET /api/visits/:identifier
 */
exports.getById = async (req, res, next) => {
  try {
    const visit = await Visit.findBySlugOrId(req.params.id)
      .populate('museumId')
      .populate('creatorId', 'username')
      .populate({
        path: 'sequence.itemId',
        populate: [
          { path: 'contentRef', select: 'name author type imageRecognitionUrl coordinates' },
          { path: 'creatorId', select: 'username' },
        ],
      });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Increment view count
    await Visit.findByIdAndUpdate(visit._id, { $inc: { viewCount: 1 } });

    res.json({ visit });
  } catch (error) {
    next(error);
  }
};

/**
 * Create visit
 * POST /api/visits
 */
exports.create = async (req, res, next) => {
  try {
    const { title, museumId, description, imageUrl, sequence, type, isPublic, quiz } = req.body;

    // Process sequence to add order
    const processedSequence = (sequence || []).map((item, index) => ({
      ...item,
      order: index,
    }));

    const visit = new Visit({
      title,
      museumId,
      creatorId: req.user._id,
      description,
      imageUrl,
      sequence: processedSequence,
      type: type || 'standard',
      isPublic: isPublic !== false,
      quiz,
    });
    await visit.save();

    // Add to user's visits
    await User.findByIdAndUpdate(req.user._id, {
      $push: { myVisits: visit._id },
    });

    res.status(201).json({ visit });
  } catch (error) {
    next(error);
  }
};

/**
 * Update visit
 * PUT /api/visits/:id
 */
exports.update = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Only creator can update
    if (visit.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this visit' });
    }

    const { title, description, imageUrl, sequence, type, isPublic, quiz } = req.body;

    // Process sequence to add order
    let processedSequence;
    if (sequence) {
      processedSequence = sequence.map((item, index) => ({
        ...item,
        order: index,
      }));
    }

    Object.assign(visit, {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(processedSequence && { sequence: processedSequence }),
      ...(type && { type }),
      ...(isPublic !== undefined && { isPublic }),
      ...(quiz && { quiz }),
    });

    await visit.save();
    res.json({ visit });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete visit
 * DELETE /api/visits/:id
 */
exports.remove = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id);

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Only creator can delete
    if (visit.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this visit' });
    }

    // Remove from user's visits
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { myVisits: visit._id },
    });

    await visit.deleteOne();
    res.json({ message: 'Visit deleted' });
  } catch (error) {
    next(error);
  }
};