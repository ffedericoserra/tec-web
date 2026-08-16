/**
 * Museum Controller
 * Handles museum CRUD and related operations
 */

const Museum = require('../models/Museum');
const Content = require('../models/Content');
const Visit = require('../models/Visit');
const User = require('../models/User');

/**
 * List all museums
 * GET /api/museums
 */
exports.list = async (req, res, next) => {
  try {
    const museums = await Museum.find().select('name slug address description imageUrl').sort({ name: 1 });
    res.json({ museums });
  } catch (error) {
    next(error);
  }
};

/**
 * Get museum by ID or slug
 * GET /api/museums/:identifier
 */
exports.getById = async (req, res, next) => {
  try {
    const museum = await Museum.findBySlugOrId(req.params.id);
    if (!museum) {
      return res.status(404).json({ error: 'Museum not found' });
    }
    res.json({ museum });
  } catch (error) {
    next(error);
  }
};

/**
 * Create museum
 * POST /api/museums
 */
exports.create = async (req, res, next) => {
  try {
    const { name, address, description, website, email, phone, openingHours, mapData, pointsOfInterest, imageUrl } = req.body;

    const museum = new Museum({
      name,
      address,
      description,
      website,
      email,
      phone,
      openingHours,
      mapData,
      pointsOfInterest,
      imageUrl,
    });
    await museum.save();

    res.status(201).json({ museum });
  } catch (error) {
    next(error);
  }
};

/**
 * Update museum
 * PUT /api/museums/:id
 */
exports.update = async (req, res, next) => {
  try {
    const { name, address, description, website, email, phone, openingHours, mapData, pointsOfInterest, imageUrl } = req.body;

    const museum = await Museum.findByIdAndUpdate(
      req.params.id,
      { name, address, description, website, email, phone, openingHours, mapData, pointsOfInterest, imageUrl },
      { new: true, runValidators: true }
    );

    if (!museum) {
      return res.status(404).json({ error: 'Museum not found' });
    }

    res.json({ museum });
  } catch (error) {
    next(error);
  }
};

/**
 * Save museum to user's list
 * POST /api/museums/:id/save
 */
exports.saveMuseum = async (req, res, next) => {
  try {
    const museumId = req.params.id;

    // Verify museum exists
    const museum = await Museum.findById(museumId);
    if (!museum) {
      return res.status(404).json({ error: 'Museum not found' });
    }

    // Add to saved if not already
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { savedMuseums: museumId },
    });

    res.json({ message: 'Museum saved' });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove museum from user's saved list
 * DELETE /api/museums/:id/save
 */
exports.unsaveMuseum = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { savedMuseums: req.params.id },
    });

    res.json({ message: 'Museum removed from saved' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Contents for a museum
 * GET /api/museums/:id/contents
 */
exports.getContents = async (req, res, next) => {
  try {
    const museum = await Museum.findBySlugOrId(req.params.id);
    if (!museum) {
      return res.status(404).json({ error: 'Museum not found' });
    }

    const { type } = req.query;
    const query = { museumId: museum._id };

    if (type) {
      query.type = type;
    }

    const contents = await Content.find(query).sort({ name: 1 });
    res.json({ contents });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Content for a museum
 * POST /api/museums/:id/contents
 */
exports.createContent = async (req, res, next) => {
  try {
    const {
      type,
      universalId,
      name,
      author,
      year,
      imageUrl,
      imgPath,
      imageRecognitionUrl,
      coordinates,
      qrCode,
    } = req.body;

    // Verify museum exists
    const museum = await Museum.findById(req.params.id);
    if (!museum) {
      return res.status(404).json({ error: 'Museum not found' });
    }

    const content = new Content({
      type,
      museumId: req.params.id,
      universalId,
      name,
      author,
      year,
      imageUrl,
      imgPath,
      imageRecognitionUrl,
      coordinates,
      qrCode,
    });
    await content.save();

    res.status(201).json({ content });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public visits for a museum
 * GET /api/museums/:id/visits
 */
exports.getVisits = async (req, res, next) => {
  try {
    const museum = await Museum.findBySlugOrId(req.params.id);
    if (!museum) {
      return res.status(404).json({ error: 'Museum not found' });
    }

    const visibleVisits = [{ isPublic: true }];
    if (req.user?._id) {
      visibleVisits.push({ creatorId: req.user._id });
    }

    const query = {
      museumId: museum._id,
      $or: visibleVisits,
    };

    const visits = await Visit.find(query)
      .select('title slug description imageUrl sequence type length isPublic viewCount createdAt creatorId')
      .populate('creatorId', 'username')
      // Only contentId: the navigator's visit list resolves stop names through
      // the museum's contents, so the full Item docs would be dead weight here.
      .populate({ path: 'sequence.itemId', select: 'contentId' })
      .sort({ viewCount: -1 });

    res.json({ visits });
  } catch (error) {
    next(error);
  }
};
