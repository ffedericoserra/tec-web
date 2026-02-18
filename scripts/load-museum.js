/**
 * Museum Configuration Loader
 * Reads JSON config files and upserts museum + contents into MongoDB
 *
 * Usage:
 *   node scripts/load-museum.js data/museums/uffizi.json   # single file
 *   node scripts/load-museum.js data/museums/              # all .json in directory
 */

const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../src/config/db');
const Museum = require('../src/models/Museum');
const Content = require('../src/models/Content');

// Same logic as Museum.js pre-save hook
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Load a single museum config file into the database
 * Idempotent: upserts museum by slug, contents by universalId
 */
async function loadMuseumFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const config = JSON.parse(raw);

  // Validate structure
  if (!config.museum || !config.museum.name) {
    throw new Error(`Invalid config: missing museum.name in ${filePath}`);
  }
  if (!Array.isArray(config.contents)) {
    throw new Error(`Invalid config: missing contents array in ${filePath}`);
  }

  // Validate all contents have universalId (needed for idempotent upsert)
  for (const content of config.contents) {
    if (!content.universalId) {
      throw new Error(`Content "${content.name}" is missing universalId in ${filePath}`);
    }
  }

  // 1. Upsert museum by slug
  const slug = generateSlug(config.museum.name);
  let museum = await Museum.findOne({ slug });

  if (museum) {
    museum.set(config.museum);
    await museum.save();
    console.log(`  Updated museum: ${museum.name}`);
  } else {
    museum = new Museum(config.museum);
    await museum.save();
    console.log(`  Created museum: ${museum.name}`);
  }

  // 2. Upsert contents by universalId
  for (const contentData of config.contents) {
    await Content.findOneAndUpdate(
      { universalId: contentData.universalId },
      { ...contentData, museumId: museum._id },
      { upsert: true, runValidators: true }
    );
  }
  console.log(`  Loaded ${config.contents.length} contents`);

  return { museum, contentsCount: config.contents.length };
}

/**
 * Load museum configs from a file or directory
 */
async function loadMuseums(target) {
  const resolved = path.resolve(target);
  const stat = fs.statSync(resolved);
  const results = [];

  if (stat.isDirectory()) {
    const files = fs.readdirSync(resolved)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => path.join(resolved, f));

    for (const file of files) {
      console.log(`Loading ${path.basename(file)}...`);
      results.push(await loadMuseumFromFile(file));
    }
  } else {
    console.log(`Loading ${path.basename(resolved)}...`);
    results.push(await loadMuseumFromFile(resolved));
  }

  return results;
}

// Export for use as module (e.g., from seed.js)
module.exports = { loadMuseumFromFile, loadMuseums };

// Run directly if executed as main script
if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/load-museum.js <file-or-directory>');
    process.exit(1);
  }

  (async () => {
    try {
      await connectDB();
      await loadMuseums(target);
      await disconnectDB();
      process.exit(0);
    } catch (error) {
      console.error('Load error:', error.message);
      await disconnectDB();
      process.exit(1);
    }
  })();
}
