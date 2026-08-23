/**
 * Database Seeding Script
 * Creates test data for ArtAround application
 *
 * Loads museums from config files (data/museums/*.json),
 * then creates test users, items, and visits as demo fixtures.
 *
 * Usage: npm run seed
 */

const path = require('path');
const fs = require('fs');
const { connectDB, disconnectDB } = require('../src/config/db');
const { loadMuseums } = require('./load-museum');

const User = require('../src/models/User');
const Museum = require('../src/models/Museum');
const Content = require('../src/models/Content');
const Item = require('../src/models/Item');
const Visit = require('../src/models/Visit');
const Session = require('../src/models/Session');

// Descrizioni scritte a mano per ogni opera del seed (3 toni x 3 durate
// 15/30/60s), tenute in un file dati a parte per non appesantire lo script.
// Chiave: Content.universalId. Vedi data/item-descriptions.json.
const itemDescriptionsByContentId = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/item-descriptions.json'), 'utf8')
);

async function seed() {
  try {
    await connectDB();

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Museum.deleteMany({}),
      Content.deleteMany({}),
      Item.deleteMany({}),
      Visit.deleteMany({}),
      Session.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // =====================
    // 1. CREATE USERS
    // =====================
    const users = await User.create([
      {
        username: 'autore1',
        password: '12345678',
        walletBalance: 500,
      },
      {
        username: 'visitatore1',
        password: '12345678',
        walletBalance: 100,
      },
      {
        username: 'docente1',
        password: '12345678',
        walletBalance: 200,
      },
    ]);
    console.log(`Created ${users.length} users`);

    const [autore, visitatore, docente] = users;

    // =====================
    // 2. LOAD MUSEUMS FROM CONFIG FILES
    // =====================
    const museumsDir = path.join(__dirname, '../data/museums');
    await loadMuseums(museumsDir);

    // Get loaded museums and contents for creating items/visits
    const uffizi = await Museum.findOne({ slug: 'galleria-degli-uffizi' });
    const mambo = await Museum.findOne({ slug: 'mambo-museo-darte-moderna-di-bologna' });
    const uffiziContents = await Content.find({ museumId: uffizi._id, type: 'Artwork' });
    const mamboContents = await Content.find({ museumId: mambo._id, type: 'Artwork' });

    // =====================
    // 3. CREATE ITEMS
    // =====================
    // Ogni opera ha 9 testi scritti a mano (3 toni x 3 durate 15/30/60s),
    // caricati da data/item-descriptions.json e indicizzati per
    // Content.universalId. Nessuna frase generica basata su un template:
    // se un'opera non ha un testo dedicato lo segnaliamo invece di
    // inventare un placeholder silenzioso.
    const getDescriptionsForContent = (content) => {
      const descriptions = itemDescriptionsByContentId[content.universalId];
      if (!descriptions) {
        throw new Error(
          `Nessuna descrizione scritta a mano per "${content.universalId}" (${content.name}). ` +
          `Aggiungila a data/item-descriptions.json prima di rilanciare il seed.`
        );
      }
      return descriptions;
    };

    // Create items for Uffizi artworks
    const uffiziItems = [];
    for (const content of uffiziContents) {
      const item = await Item.create({
        contentId: content.universalId,
        creatorId: autore._id,
        targetAudience: 'tourist',
        descriptions: getDescriptionsForContent(content),
        price: Math.floor(Math.random() * 10) * 5,
        license: 'CC-BY',
        isPublic: true,
      });
      uffiziItems.push(item);
    }

    // Create items for MAMbo artworks
    const mamboItems = [];
    for (const content of mamboContents) {
      const item = await Item.create({
        contentId: content.universalId,
        creatorId: autore._id,
        targetAudience: 'tourist',
        descriptions: getDescriptionsForContent(content),
        price: Math.floor(Math.random() * 10) * 5,
        license: 'CC-BY',
        isPublic: true,
      });
      mamboItems.push(item);
    }
    console.log(`Created ${uffiziItems.length + mamboItems.length} items`);

    // =====================
    // 4. CREATE VISITS
    // =====================
    const createVisitSequence = (itemList, startIndex, count) => {
      const sequence = [];
      const directions = [
        'Prosegui dritto lungo il corridoio',
        'Gira a destra dopo la colonna',
        'Entra nella sala successiva',
        'Vai verso la finestra',
        'Attraversa l\'arco sulla sinistra',
        'Segui il corridoio fino in fondo',
        'Prosegui verso nord',
        'Oltrepassa la porta sulla destra',
        'Continua lungo il percorso segnato',
        'Vai verso la grande finestra',
      ];

      for (let i = 0; i < count && i < itemList.length; i++) {
        const idx = (startIndex + i) % itemList.length;
        sequence.push({
          itemId: itemList[idx]._id,
          order: i + 1,
          nextDirections: i < count - 1 ? directions[i % directions.length] : '',
          prevDirections: i > 0 ? directions[(i - 1) % directions.length] : '',
        });
      }
      return sequence;
    };

    const visits = await Visit.create([
      // Uffizi visits
      {
        title: 'Capolavori del Rinascimento',
        museumId: uffizi._id,
        creatorId: autore._id,
        description:
          'Un percorso attraverso i più grandi capolavori del Rinascimento fiorentino, da Botticelli a Michelangelo.',
        sequence: createVisitSequence(uffiziItems, 0, 10),
        type: 'standard',
        length: 'deep',
        isPublic: true,
        imageUrl: '/uploads/visits/rinascimento.jpg',
      },
      {
        title: 'Botticelli e i suoi contemporanei',
        museumId: uffizi._id,
        creatorId: autore._id,
        description:
          'Esplora l\'arte di Botticelli e degli artisti che hanno condiviso la sua epoca.',
        sequence: createVisitSequence(uffiziItems, 0, 5),
        type: 'standard',
        length: 'quick',
        isPublic: true,
        imageUrl: '/uploads/visits/botticelli.jpg',
      },
      {
        title: 'Visita guidata scuole',
        museumId: uffizi._id,
        creatorId: docente._id,
        description:
          'Percorso didattico per gruppi scolastici con quiz finale.',
        sequence: createVisitSequence(uffiziItems, 2, 8),
        type: 'synchronized',
        length: 'normal',
        sessionCode: 'SCUOLA_ARTE',
        isPublic: false,
        quiz: [
          {
            question: 'Chi ha dipinto "La nascita di Venere"?',
            options: ['Leonardo da Vinci', 'Sandro Botticelli', 'Michelangelo', 'Raffaello'],
            correctIndex: 1,
          },
          {
            question: 'In che secolo è stato realizzato il "Tondo Doni"?',
            options: ['XIV secolo', 'XV secolo', 'XVI secolo', 'XVII secolo'],
            correctIndex: 2,
          },
          {
            question: 'Quale artista è famoso per lo "sfumato"?',
            options: ['Caravaggio', 'Tiziano', 'Leonardo da Vinci', 'Giotto'],
            correctIndex: 2,
          },
        ],
        imageUrl: '/uploads/visits/scuole.jpg',
      },
      // MAMbo visits
      {
        title: 'Arte Moderna e Contemporanea',
        museumId: mambo._id,
        creatorId: autore._id,
        description:
          'Un viaggio attraverso le correnti artistiche del Novecento italiano, da Morandi all\'Arte Povera.',
        sequence: createVisitSequence(mamboItems, 0, 10),
        type: 'standard',
        length: 'deep',
        isPublic: true,
        imageUrl: '/uploads/visits/mambo-moderna.jpg',
      },
      {
        title: 'Morandi e lo Spazialismo',
        museumId: mambo._id,
        creatorId: autore._id,
        description:
          'Dalle nature morte di Morandi ai tagli di Fontana: due visioni dell\'arte italiana.',
        sequence: createVisitSequence(mamboItems, 0, 5),
        type: 'standard',
        length: 'quick',
        isPublic: true,
        imageUrl: '/uploads/visits/mambo-morandi.jpg',
      },
      {
        title: 'Visita guidata Arte Povera',
        museumId: mambo._id,
        creatorId: docente._id,
        description:
          'Percorso didattico sul movimento dell\'Arte Povera con quiz finale.',
        sequence: createVisitSequence(mamboItems, 4, 6),
        type: 'synchronized',
        length: 'normal',
        sessionCode: 'ARTE_POVERA',
        isPublic: false,
        quiz: [
          {
            question: 'Quale artista è noto per i "tagli" sulla tela?',
            options: ['Giorgio Morandi', 'Lucio Fontana', 'Alberto Burri', 'Emilio Vedova'],
            correctIndex: 1,
          },
          {
            question: 'Cos\'è l\'Arte Povera?',
            options: ['Arte fatta con materiali economici', 'Movimento artistico italiano degli anni \'60', 'Arte dei paesi poveri', 'Stile minimalista'],
            correctIndex: 1,
          },
          {
            question: 'Chi ha creato la "Venere degli stracci"?',
            options: ['Jannis Kounellis', 'Giulio Paolini', 'Michelangelo Pistoletto', 'Pino Pascali'],
            correctIndex: 2,
          },
        ],
        imageUrl: '/uploads/visits/mambo-povera.jpg',
      },
    ]);
    console.log(`Created ${visits.length} visits`);

    // Link visits to users
    autore.myVisits.push(visits[0]._id, visits[1]._id, visits[3]._id, visits[4]._id);
    docente.myVisits.push(visits[2]._id, visits[5]._id);
    visitatore.savedMuseums.push(uffizi._id, mambo._id);

    await Promise.all([autore.save(), docente.save(), visitatore.save()]);
    console.log('Updated user references');

    // =====================
    // SUMMARY
    // =====================
    const allMuseums = await Museum.find();
    const allContents = await Content.find();
    console.log('\n=== SEED COMPLETE ===');
    console.log(`Users: ${users.length}`);
    console.log(`  - autore1 (password: 12345678)`);
    console.log(`  - visitatore1 (password: 12345678)`);
    console.log(`  - docente1 (password: 12345678)`);
    console.log(`Museums: ${allMuseums.length}`);
    allMuseums.forEach(m => console.log(`  - ${m.name}`));
    console.log(`Contents: ${allContents.length}`);
    console.log(`Items: ${uffiziItems.length + mamboItems.length}`);
    console.log(`Visits: ${visits.length}`);
    console.log(`  - ${visits.map((v) => v.title).join(', ')}`);
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
}

// Export for use as module (e.g., from index.js)
module.exports = seed;

// Run directly if executed as main script (npm run seed)
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seed();
      await disconnectDB();
      process.exit(0);
    } catch (error) {
      await disconnectDB();
      process.exit(1);
    }
  })();
}
