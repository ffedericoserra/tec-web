/**
 * Visit Controller
 * Handles visit CRUD operations
 */

const Visit = require('../models/Visit');
const User = require('../models/User');
const Item = require('../models/Item');

function processSequence(sequence = []) {
  return sequence.map((item, index) => ({
    ...item,
    order: index,
  }));
}

function processBlocks(blocks = []) {
  return blocks.map((block) => ({
    blockName: block.blockName || 'Mainboard',
    items: block.items || [],
  }));
}

function buildItemCountMap(sequence = []) {
  return sequence.reduce((counts, item) => {
    const itemId = String(item.itemId);
    counts[itemId] = (counts[itemId] || 0) + 1;
    return counts;
  }, {});
}

function getAdditionalItemIds(nextSequence = [], previousSequence = []) {
  const previousCounts = buildItemCountMap(previousSequence);
  const nextCounts = buildItemCountMap(nextSequence);
  const additionalItemIds = [];

  Object.entries(nextCounts).forEach(([itemId, nextCount]) => {
    const previousCount = previousCounts[itemId] || 0;
    const difference = nextCount - previousCount;

    if (difference > 0) {
      for (let index = 0; index < difference; index += 1) {
        additionalItemIds.push(itemId);
      }
    }
  });

  return additionalItemIds;
}

async function chargeVisitItems(userId, additionalItemIds = []) {
  if (!additionalItemIds.length) {
    const user = await User.findById(userId).select('walletBalance');
    return {
      chargedAmount: 0,
      walletBalance: user ? user.walletBalance : 0,
    };
  }

  const items = await Item.find({ _id: { $in: additionalItemIds } }).select('price creatorId');
  const itemsMap = new Map(items.map((item) => [String(item._id), item]));

  let chargedAmount = 0;
  const creatorCredits = new Map();

  additionalItemIds.forEach((itemId) => {
    const item = itemsMap.get(String(itemId));

    if (!item) {
      return;
    }

    const price = Number(item.price) || 0;
    chargedAmount += price;

    if (price > 0 && String(item.creatorId) !== String(userId)) {
      const creatorKey = String(item.creatorId);
      creatorCredits.set(creatorKey, (creatorCredits.get(creatorKey) || 0) + price);
    }
  });

  if (chargedAmount > 0) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: chargedAmount } },
      { $inc: { walletBalance: -chargedAmount } },
      { new: true }
    ).select('walletBalance');

    if (!updatedUser) {
      const error = new Error('Insufficient balance');
      error.statusCode = 400;
      throw error;
    }

    await Promise.all(
      Array.from(creatorCredits.entries()).map(([creatorId, amount]) =>
        User.findByIdAndUpdate(creatorId, {
          $inc: { walletBalance: amount },
        })
      )
    );

    return {
      chargedAmount,
      walletBalance: updatedUser.walletBalance,
    };
  }

  const user = await User.findById(userId).select('walletBalance');
  return {
    chargedAmount: 0,
    walletBalance: user ? user.walletBalance : 0,
  };
}

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
      .populate('museumId', 'name slug')
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
        populate: { path: 'creatorId', select: 'username' },
      });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Increment view count
    await Visit.findByIdAndUpdate(visit._id, { $inc: { viewCount: 1 } });

    /* The quiz key never leaves the server for anyone but the visit's author.
     * The navigator's session runner reads the questions from here, so without
     * this a student could just open the visit and read off the answers. */
    const obj = visit.toObject();
    const isCreator =
      req.user && visit.creatorId?._id?.toString() === req.user._id.toString();
    if (!isCreator && obj.quiz?.length) {
      obj.quiz = obj.quiz.map((q) => ({
        question: q.question,
        options: q.options,
      }));
    }

    res.json({ visit: obj });
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
    const { title, museumId, description, imageUrl, sequence, blocks, type, length, isPublic, quiz } = req.body;

    // Process sequence to add order
    const processedSequence = processSequence(sequence || []);
    const processedBlocks = processBlocks(blocks || []);
    const additionalItemIds = getAdditionalItemIds(processedSequence, []);

    const billing = await chargeVisitItems(req.user._id, additionalItemIds);

    const visit = new Visit({
      title,
      museumId,
      creatorId: req.user._id,
      description,
      imageUrl,
      sequence: processedSequence,
      blocks: processedBlocks,
      type: type || 'standard',
      length: length || 'normal',
      isPublic: isPublic !== false,
      quiz,
    });
    await visit.save();

    // Add to user's visits
    await User.findByIdAndUpdate(req.user._id, {
      $push: { myVisits: visit._id },
    });

    res.status(201).json({
      visit,
      chargedAmount: billing.chargedAmount,
      walletBalance: billing.walletBalance,
    });
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

    const { title, description, imageUrl, sequence, blocks, type, length, isPublic, quiz } = req.body;

    // Process sequence to add order
    let processedSequence;
    if (sequence) {
      processedSequence = processSequence(sequence);
    }

    let processedBlocks;
    if (blocks) {
      processedBlocks = processBlocks(blocks);
    }

    const additionalItemIds = processedSequence
      ? getAdditionalItemIds(processedSequence, visit.sequence || [])
      : [];
    const billing = await chargeVisitItems(req.user._id, additionalItemIds);

    Object.assign(visit, {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(processedSequence && { sequence: processedSequence }),
      ...(processedBlocks && { blocks: processedBlocks }),
      ...(type && { type }),
      ...(length && { length }),
      ...(isPublic !== undefined && { isPublic }),
      ...(quiz && { quiz }),
    });

    await visit.save();
    res.json({
      visit,
      chargedAmount: billing.chargedAmount,
      walletBalance: billing.walletBalance,
    });
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
