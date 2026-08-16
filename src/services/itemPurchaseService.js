const Item = require('../models/Item');
const User = require('../models/User');
const mongoose = require('mongoose');

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function adoptItems(userId, itemIds = []) {
  const uniqueIds = [...new Set(itemIds.map(String).filter(Boolean))];
  if (uniqueIds.some((itemId) => !mongoose.Types.ObjectId.isValid(itemId))) {
    throw httpError('One or more item identifiers are invalid', 400);
  }
  const user = await User.findById(userId).select('walletBalance purchasedItems');
  if (!user) throw httpError('User not found', 404);

  if (uniqueIds.length === 0) {
    return {
      chargedAmount: 0,
      walletBalance: user.walletBalance,
      adoptedItemIds: [],
    };
  }

  const items = await Item.find({ _id: { $in: uniqueIds } }).select(
    'creatorId price isPublic'
  );
  if (items.length !== uniqueIds.length) {
    throw httpError('One or more items do not exist', 400);
  }

  const purchased = new Set(user.purchasedItems.map(String));
  const adoptable = items.filter(
    (item) =>
      item.creatorId.toString() !== userId.toString() &&
      !purchased.has(item._id.toString())
  );

  const unavailable = adoptable.find((item) => !item.isPublic);
  if (unavailable) {
    throw httpError('A private item cannot be adopted', 403);
  }

  const chargedAmount = adoptable.reduce(
    (total, item) => total + (Number(item.price) || 0),
    0
  );
  const adoptedItemIds = adoptable.map((item) => item._id);

  if (adoptedItemIds.length === 0) {
    return {
      chargedAmount: 0,
      walletBalance: user.walletBalance,
      adoptedItemIds: [],
    };
  }

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      walletBalance: { $gte: chargedAmount },
      purchasedItems: { $nin: adoptedItemIds },
    },
    {
      $inc: { walletBalance: -chargedAmount },
      $addToSet: { purchasedItems: { $each: adoptedItemIds } },
    },
    { new: true }
  ).select('walletBalance');

  if (!updatedUser) {
    const current = await User.findById(userId).select('walletBalance');
    if (!current || current.walletBalance < chargedAmount) {
      throw httpError('Insufficient balance', 400);
    }
    throw httpError('Items were already adopted in another request', 409);
  }

  const creatorCredits = new Map();
  adoptable.forEach((item) => {
    const creatorId = item.creatorId.toString();
    const price = Number(item.price) || 0;
    creatorCredits.set(creatorId, (creatorCredits.get(creatorId) || 0) + price);
  });

  await Promise.all([
    User.bulkWrite(
      [...creatorCredits.entries()].map(([creatorId, amount]) => ({
        updateOne: {
          filter: { _id: creatorId },
          update: { $inc: { walletBalance: amount } },
        },
      }))
    ),
    Item.bulkWrite(
      adoptable.map((item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $inc: {
              salesCount: 1,
              revenue: Number(item.price) || 0,
            },
          },
        },
      }))
    ),
  ]);

  return {
    chargedAmount,
    walletBalance: updatedUser.walletBalance,
    adoptedItemIds: adoptedItemIds.map(String),
  };
}

module.exports = { adoptItems };
