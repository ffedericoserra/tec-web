const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');

async function migrateUniversalIds() {
  await connectDB();

  const contentsCollection = mongoose.connection.collection('contents');
  const itemsCollection = mongoose.connection.collection('items');
  const contents = await contentsCollection
    .find({}, { projection: { _id: 1, universalId: 1 } })
    .toArray();
  const usedIds = new Set();
  const duplicateIds = new Set();

  contents.forEach((content) => {
    const universalId = content.universalId?.trim();
    if (!universalId) return;
    if (usedIds.has(universalId)) duplicateIds.add(universalId);
    usedIds.add(universalId);
  });

  if (duplicateIds.size > 0) {
    throw new Error(`Duplicate universal IDs: ${[...duplicateIds].join(', ')}`);
  }

  const generatedByContentId = new Map();
  contents.forEach((content) => {
    if (content.universalId?.trim()) return;
    let universalId;
    do {
      universalId = `urn:artaround:content:${crypto.randomUUID()}`;
    } while (usedIds.has(universalId));
    usedIds.add(universalId);
    generatedByContentId.set(content._id.toString(), universalId);
  });

  const universalIdByContentId = new Map(
    contents.map((content) => [
      content._id.toString(),
      content.universalId?.trim() || generatedByContentId.get(content._id.toString()),
    ])
  );
  const validUniversalIds = new Set(universalIdByContentId.values());
  const items = await itemsCollection
    .find({}, { projection: { _id: 1, contentId: 1 } })
    .toArray();
  const orphanItems = [];
  const itemUpdates = [];

  items.forEach((item) => {
    const currentId = item.contentId?.trim();
    if (validUniversalIds.has(currentId)) return;

    const migratedId = mongoose.Types.ObjectId.isValid(currentId)
      ? universalIdByContentId.get(currentId)
      : null;
    if (!migratedId) {
      orphanItems.push(`${item._id}:${currentId || '<empty>'}`);
      return;
    }

    itemUpdates.push({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { contentId: migratedId } },
      },
    });
  });

  if (orphanItems.length > 0) {
    throw new Error(`Items with unresolved contentId: ${orphanItems.join(', ')}`);
  }

  const contentUpdates = [...generatedByContentId.entries()].map(([contentId, universalId]) => ({
    updateOne: {
      filter: { _id: contentId },
      update: { $set: { universalId } },
    },
  }));

  if (contentUpdates.length > 0) {
    await contentsCollection.bulkWrite(contentUpdates);
  }
  if (itemUpdates.length > 0) {
    await itemsCollection.bulkWrite(itemUpdates);
  }

  const universalIndex = (await contentsCollection.indexes()).find(
    (index) => index.key?.universalId === 1
  );
  if (universalIndex && (!universalIndex.unique || universalIndex.sparse)) {
    await contentsCollection.dropIndex(universalIndex.name);
  }
  if (!universalIndex || !universalIndex.unique || universalIndex.sparse) {
    await contentsCollection.createIndex({ universalId: 1 }, { unique: true });
  }

  console.log(
    `Migration complete: ${contentUpdates.length} universal IDs generated, ` +
      `${itemUpdates.length} item references updated.`
  );
}

migrateUniversalIds()
  .catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
