/**
 * Item Controller
 * Handles item CRUD and marketplace operations
 */

const Item = require('../models/Item');
const Content = require('../models/Content');
const Visit = require('../models/Visit');
const User = require('../models/User');
const mongoose = require('mongoose');
const { adoptItems } = require('../services/itemPurchaseService');

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isItemCreator(item, user) {
  if (!user || !item.creatorId) return false;
  const creatorId = item.creatorId._id || item.creatorId;
  return creatorId.toString() === user._id.toString();
}

function hasPurchasedItem(item, user) {
  return Boolean(
    user && user.purchasedItems.some((itemId) => itemId.toString() === item._id.toString())
  );
}

function serializeItem(item, user) {
  const result = item.toObject();
  result.isOwned = isItemCreator(item, user);
  result.isPurchased = hasPurchasedItem(item, user);
  result.adoptionPrice = result.isOwned || result.isPurchased ? 0 : result.price;
  if (!result.isOwned) delete result.revenue;
  return result;
}

async function validateContentLinks(contentId, associatedContents = []) {
  const mainContent = await Content.findOne({ universalId: contentId }).select(
    '_id museumId universalId'
  );
  if (!mainContent) {
    throw httpError('contentId must match an existing Content.universalId');
  }

  const associatedIds = [...new Set(associatedContents.map(String))];
  if (associatedIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw httpError('associatedContents contains an invalid identifier');
  }
  if (associatedIds.includes(mainContent._id.toString())) {
    throw httpError('The main content cannot also be an associated content');
  }

  if (associatedIds.length > 0) {
    const validCount = await Content.countDocuments({
      _id: { $in: associatedIds },
      museumId: mainContent.museumId,
    });
    if (validCount !== associatedIds.length) {
      throw httpError('Associated contents must exist in the same museum');
    }
  }

  return associatedIds;
}

/**
 * List items
 * GET /api/items
 * Query params: contentId, creatorId, isPublic, targetAudience
 */
exports.list = async (req, res, next) => {
  try {
    const { contentId, creatorId, isPublic, targetAudience } = req.query;
    const filters = [];
    const requestedFilters = {};

    if (contentId) requestedFilters.contentId = contentId;
    if (creatorId) requestedFilters.creatorId = creatorId;
    if (targetAudience) requestedFilters.targetAudience = targetAudience;
    filters.push(requestedFilters);

    if (isPublic !== undefined) {
      if (isPublic === 'true') {
        filters.push({ isPublic: true });
      } else if (req.user) {
        filters.push({ isPublic: false, creatorId: req.user._id });
      } else {
        filters.push({ _id: null });
      }
    } else if (req.user) {
      filters.push({
        $or: [
          { isPublic: true },
          { creatorId: req.user._id },
          { _id: { $in: req.user.purchasedItems } },
        ],
      });
    } else {
      filters.push({ isPublic: true });
    }

    const items = await Item.find({ $and: filters })
      .populate('creatorId', 'username')
      .sort({ createdAt: -1 });

    res.json({ items: items.map((item) => serializeItem(item, req.user)) });
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
      .populate('associatedContents');

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const canRead = item.isPublic || isItemCreator(item, req.user) || hasPurchasedItem(item, req.user);
    const isUsedByPublicVisit = canRead
      ? false
      : Boolean(await Visit.exists({ isPublic: true, 'sequence.itemId': item._id }));

    if (!canRead && !isUsedByPublicVisit) {
      return res.status(403).json({ error: 'Not authorized to view this item' });
    }

    res.json({ item: serializeItem(item, req.user) });
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
      targetAudience,
      descriptions,
      price,
      license,
      isPublic,
      associatedContents,
    } = req.body;
    const validAssociatedContents = await validateContentLinks(
      contentId,
      associatedContents || []
    );

    const item = new Item({
      contentId,
      creatorId: req.user._id,
      targetAudience,
      descriptions,
      price,
      license,
      isPublic,
      associatedContents: validAssociatedContents,
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
    let validAssociatedContents;
    if (associatedContents !== undefined) {
      validAssociatedContents = await validateContentLinks(item.contentId, associatedContents);
    }

    Object.assign(item, {
      ...(targetAudience && { targetAudience }),
      ...(descriptions && { descriptions }),
      ...(price !== undefined && { price }),
      ...(license && { license }),
      ...(isPublic !== undefined && { isPublic }),
      ...(validAssociatedContents !== undefined && {
        associatedContents: validAssociatedContents,
      }),
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

    const isUsedByVisit = await Visit.exists({ 'sequence.itemId': item._id });
    if (isUsedByVisit) {
      return res.status(409).json({ error: 'Items used by a visit cannot be deleted' });
    }

    await Promise.all([
      User.updateMany({ purchasedItems: item._id }, { $pull: { purchasedItems: item._id } }),
      item.deleteOne(),
    ]);
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

    if (isItemCreator(item, req.user)) {
      return res.status(400).json({ error: 'Creators already own their items' });
    }

    const result = await adoptItems(req.user._id, [item._id]);
    res.json({
      message:
        result.adoptedItemIds.length > 0
          ? 'Item purchased successfully'
          : 'Item already purchased',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
