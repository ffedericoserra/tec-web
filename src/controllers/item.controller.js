/**
 * Item Controller
 * Handles item CRUD and marketplace operations
 */

const Item = require('../models/Item');
const User = require('../models/User');
const Content = require('../models/Content');

/**
 * List items
 * GET /api/items
 * Query params: contentId, creatorId, isPublic, targetAudience
 */
exports.list = async (req, res, next) => {
  try {
    const { contentId, creatorId, isPublic, targetAudience } = req.query;
    const query = {};

    if (contentId) query.contentId = contentId;
    if (creatorId) query.creatorId = creatorId;
    if (targetAudience) query.targetAudience = targetAudience;

    // Filter by public status
    if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    } else if (!req.user) {
      // Non-authenticated users only see public items
      query.isPublic = true;
    }

    const items = await Item.find(query)
      .populate('creatorId', 'username')
      .populate('contentRef', 'name type imageRecognitionUrl')
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    next(error);
  }
};

/**
 * Get item by ID
 * GET /api/items/:id
 */
exports.getById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('creatorId', 'username')
      .populate('contentRef')
      .populate('associatedContents');

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item });
  } catch (error) {
    next(error);
  }
};

/**
 * Create item
 * POST /api/items
 */
exports.create = async (req, res, next) => {
  try {
    const {
      contentId,
      rawContentRef,
      targetAudience,
      descriptions,
      price,
      license,
      isPublic,
      associatedContents,
    } = req.body;

    // Find Content if not provided
    let contentRefId = rawContentRef;
    if (!contentRefId && contentId) {
      const content = await Content.findOne({ universalId: contentId });
      if (content) {
        contentRefId = content._id;
      }
    }

    const item = new Item({
      contentId,
      contentRef: contentRefId,
      creatorId: req.user._id,
      targetAudience,
      descriptions,
      price,
      license,
      isPublic,
      associatedContents,
    });
    await item.save();

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
};

/**
 * Update item
 * PUT /api/items/:id
 */
exports.update = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Only creator can update
    if (item.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this item' });
    }

    const { targetAudience, descriptions, price, license, isPublic, associatedContents } = req.body;

    Object.assign(item, {
      ...(targetAudience && { targetAudience }),
      ...(descriptions && { descriptions }),
      ...(price !== undefined && { price }),
      ...(license && { license }),
      ...(isPublic !== undefined && { isPublic }),
      ...(associatedContents && { associatedContents }),
    });

    await item.save();
    res.json({ item });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete item
 * DELETE /api/items/:id
 */
exports.remove = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Only creator can delete
    if (item.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this item' });
    }

    await item.deleteOne();
    res.json({ message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Purchase item from marketplace
 * POST /api/items/:id/purchase
 */
exports.purchase = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item.isPublic) {
      return res.status(400).json({ error: 'Item is not available for purchase' });
    }

    // Check if already purchased
    if (req.user.purchasedItems.includes(item._id)) {
      return res.status(400).json({ error: 'Item already purchased' });
    }

    // Check wallet balance
    if (req.user.walletBalance < item.price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Process purchase
    await User.findByIdAndUpdate(req.user._id, {
      $push: { purchasedItems: item._id },
      $inc: { walletBalance: -item.price },
    });

    // Credit creator (if not free)
    if (item.price > 0) {
      await User.findByIdAndUpdate(item.creatorId, {
        $inc: { walletBalance: item.price },
      });
    }

    res.json({ message: 'Item purchased successfully' });
  } catch (error) {
    next(error);
  }
};