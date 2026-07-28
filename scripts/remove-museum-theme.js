/**
 * Removes the deprecated museum.theme field from existing MongoDB documents.
 *
 * Usage:
 *   node scripts/remove-museum-theme.js
 */

const { connectDB, disconnectDB } = require('../src/config/db');
const Museum = require('../src/models/Museum');

(async () => {
  try {
    await connectDB();

    const result = await Museum.updateMany(
      { theme: { $exists: true } },
      { $unset: { theme: '' } },
      { strict: false }
    );

    console.log(`Removed theme from ${result.modifiedCount || 0} museums`);
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('Theme cleanup error:', error.message);
    await disconnectDB();
    process.exit(1);
  }
})();
