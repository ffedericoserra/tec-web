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

    // The group tours name their Content IDs explicitly instead of relying on
    // MongoDB's natural query order. Their artwork blocks must flatten to the
    // exact same Item order as `sequence` for the synchronized runner.
    const getItemsForContents = (itemList, contentIds) =>
      contentIds.map((contentId) => {
        const item = itemList.find((candidate) => candidate.contentId === contentId);
        if (!item) {
          throw new Error(`Item seed mancante per il contenuto "${contentId}"`);
        }
        return item;
      });

    const itemIds = (itemList) => itemList.map((item) => item._id);

    const uffiziGroupItems = getItemsForContents(uffiziItems, [
      'uffizi-giotto-maesta',
      'uffizi-gentile-magi',
      'uffizi-leonardo-annunciazione',
      'uffizi-botticelli-primavera',
      'uffizi-botticelli-venere',
      'uffizi-raffaello-cardellino',
      'uffizi-michelangelo-tondodoni',
      'uffizi-tiziano-venere',
      'uffizi-caravaggio-bacco',
      'uffizi-caravaggio-medusa',
    ]);

    const mamboGroupItems = getItemsForContents(mamboItems, [
      'mambo-morandi-natura-morta-1946',
      'mambo-morandi-paesaggio',
      'mambo-burri-rosso-plastica',
      'mambo-fontana-concetto-spaziale',
      'mambo-de-chirico-ettore-andromaca',
      'mambo-vedova-plurimo',
      'mambo-kounellis-senza-titolo',
      'mambo-paolini-giovane-guardando-lorenzo-lotto',
      'mambo-pascali-bachi-da-setola',
      'mambo-pistoletto-venere-stracci',
    ]);

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
        title: 'Uffizi in gruppo: dal Medioevo a Caravaggio',
        museumId: uffizi._id,
        creatorId: docente._id,
        description:
          'Visita pubblica e sincronizzata attraverso i capolavori degli Uffizi, con confronti tra le opere e prova finale.',
        sequence: createVisitSequence(uffiziGroupItems, 0, uffiziGroupItems.length),
        blocks: [
          {
            type: 'artwork',
            blockName: 'Dalle origini al Rinascimento',
            items: itemIds(uffiziGroupItems.slice(0, 3)),
          },
          {
            type: 'questions',
            blockName: 'Ricapitoliamo le prime opere',
            items: [],
            questions: [
              {
                prompt: 'Quale opera appena vista è la più antica?',
                answerType: 'multiple-choice',
                options: ['Maestà di Ognissanti', 'Adorazione dei Magi', 'Annunciazione'],
                correctIndex: 0,
              },
              {
                prompt: 'Chi ha dipinto l\'Annunciazione del percorso?',
                answerType: 'multiple-choice',
                options: ['Leonardo da Vinci', 'Sandro Botticelli', 'Giotto', 'Gentile da Fabriano'],
                correctIndex: 0,
              },
            ],
          },
          {
            type: 'artwork',
            blockName: 'Le opere di Botticelli',
            items: itemIds(uffiziGroupItems.slice(3, 5)),
          },
          {
            type: 'questions',
            blockName: 'Confronto su Botticelli',
            items: [],
            questions: [
              {
                prompt: 'Quale opera di Botticelli vista nel percorso è datata 1482?',
                answerType: 'multiple-choice',
                options: ['La Primavera', 'La nascita di Venere', 'Madonna del Cardellino'],
                correctIndex: 0,
              },
              {
                prompt: 'Descrivi un elemento che accomuna La Primavera e La nascita di Venere.',
                answerType: 'open',
              },
            ],
          },
          {
            type: 'artwork',
            blockName: 'L\'Alto Rinascimento',
            items: itemIds(uffiziGroupItems.slice(5, 8)),
          },
          {
            type: 'questions',
            blockName: 'Date e autori',
            items: [],
            questions: [
              {
                prompt: 'Quale opera vista in questo blocco è stata realizzata nel 1506?',
                answerType: 'multiple-choice',
                options: ['Madonna del Cardellino', 'Tondo Doni', 'Venere di Urbino'],
                correctIndex: 0,
              },
              {
                prompt: 'Quale opera del blocco è datata 1538?',
                answerType: 'multiple-choice',
                options: ['Tondo Doni', 'Venere di Urbino', 'Madonna del Cardellino'],
                correctIndex: 1,
              },
            ],
          },
          {
            type: 'artwork',
            blockName: 'Caravaggio agli Uffizi',
            items: itemIds(uffiziGroupItems.slice(8, 10)),
          },
          {
            type: 'questions',
            blockName: 'Prova finale: capolavori degli Uffizi',
            items: [],
            questions: [
              {
                prompt: 'Quale artista ha dipinto sia Bacco sia Medusa?',
                answerType: 'multiple-choice',
                options: ['Caravaggio', 'Tiziano Vecellio', 'Leonardo da Vinci', 'Sandro Botticelli'],
                correctIndex: 0,
              },
              {
                prompt: 'Quale coppia di opere del percorso condivide l\'anno 1597?',
                answerType: 'multiple-choice',
                options: [
                  'Bacco e Medusa',
                  'La Primavera e La nascita di Venere',
                  'Madonna del Cardellino e Tondo Doni',
                  'Maestà di Ognissanti e Adorazione dei Magi',
                ],
                correctIndex: 0,
              },
              {
                prompt: 'Qual è l\'opera più antica dell\'intero itinerario?',
                answerType: 'multiple-choice',
                options: ['Maestà di Ognissanti', 'Annunciazione', 'La Primavera', 'Tondo Doni'],
                correctIndex: 0,
              },
              {
                prompt: 'Chi ha realizzato il Tondo Doni?',
                answerType: 'multiple-choice',
                options: ['Raffaello Sanzio', 'Michelangelo Buonarroti', 'Giotto', 'Gentile da Fabriano'],
                correctIndex: 1,
              },
              {
                prompt: 'Chi ha dipinto la Venere di Urbino?',
                answerType: 'multiple-choice',
                options: ['Tiziano Vecellio', 'Caravaggio', 'Sandro Botticelli', 'Leonardo da Vinci'],
                correctIndex: 0,
              },
            ],
          },
        ],
        type: 'synchronized',
        length: 'deep',
        isPublic: true,
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
        title: 'MAMbo in gruppo: materia, spazio e memoria',
        museumId: mambo._id,
        creatorId: docente._id,
        description:
          'Visita pubblica e sincronizzata attraverso le ricerche del Novecento, dalle forme silenziose di Morandi alle sperimentazioni su materia, spazio e memoria.',
        sequence: createVisitSequence(mamboGroupItems, 0, mamboGroupItems.length),
        blocks: [
          {
            type: 'artwork',
            blockName: 'Forme, paesaggi e materia',
            items: itemIds(mamboGroupItems.slice(0, 3)),
          },
          {
            type: 'questions',
            blockName: 'Confronto tra Morandi e Burri',
            items: [],
            questions: [
              {
                prompt: 'Confronta Natura morta e Paesaggio: quale somiglianza noti nell\'uso delle forme o dei colori?',
                answerType: 'open',
              },
              {
                prompt: 'Quale artista ha realizzato Rosso Plastica?',
                answerType: 'multiple-choice',
                options: ['Giorgio Morandi', 'Alberto Burri', 'Lucio Fontana', 'Emilio Vedova'],
                correctIndex: 1,
              },
            ],
          },
          {
            type: 'artwork',
            blockName: 'Oltre il quadro: spazio e gesto',
            items: itemIds(mamboGroupItems.slice(3, 6)),
          },
          {
            type: 'questions',
            blockName: 'Confronto tra immagini e spazio',
            items: [],
            questions: [
              {
                prompt: 'Quale opera appena vista è di Lucio Fontana?',
                answerType: 'multiple-choice',
                options: ['Concetto spaziale, Attese', 'Ettore e Andromaca', 'Plurimo', 'Rosso Plastica'],
                correctIndex: 0,
              },
              {
                prompt: 'Quale opera appena vista raffigura Ettore e Andromaca?',
                answerType: 'multiple-choice',
                options: ['Ettore e Andromaca', 'Senza titolo', 'Plurimo', 'Paesaggio'],
                correctIndex: 0,
              },
            ],
          },
          {
            type: 'artwork',
            blockName: 'Arte Povera e sguardi sul passato',
            items: itemIds(mamboGroupItems.slice(6, 8)),
          },
          {
            type: 'questions',
            blockName: 'Confronto tra materia e memoria',
            items: [],
            questions: [
              {
                prompt: 'Chi è l\'autore di Senza titolo vista in questo blocco?',
                answerType: 'multiple-choice',
                options: ['Jannis Kounellis', 'Giulio Paolini', 'Pino Pascali', 'Michelangelo Pistoletto'],
                correctIndex: 0,
              },
              {
                prompt: 'Quale pittore del passato è nominato nel titolo Giovane che guarda Lorenzo Lotto?',
                answerType: 'multiple-choice',
                options: ['Lorenzo Lotto', 'Sandro Botticelli', 'Caravaggio', 'Raffaello Sanzio'],
                correctIndex: 0,
              },
            ],
          },
          {
            type: 'artwork',
            blockName: 'Materiali e bellezza classica',
            items: itemIds(mamboGroupItems.slice(8, 10)),
          },
          {
            type: 'questions',
            blockName: 'Prova finale: il Novecento al MAMbo',
            items: [],
            questions: [
              {
                prompt: 'Quale opera del percorso è stata realizzata nel 1968?',
                answerType: 'multiple-choice',
                options: ['Bachi da setola', 'Venere degli stracci', 'Senza titolo', 'Concetto spaziale, Attese'],
                correctIndex: 0,
              },
              {
                prompt: 'Chi ha realizzato la Venere degli stracci?',
                answerType: 'multiple-choice',
                options: ['Jannis Kounellis', 'Giulio Paolini', 'Michelangelo Pistoletto', 'Pino Pascali'],
                correctIndex: 2,
              },
              {
                prompt: 'Quale coppia di opere del percorso è datata 1962?',
                answerType: 'multiple-choice',
                options: [
                  'Rosso Plastica e Plurimo',
                  'Natura morta e Paesaggio',
                  'Ettore e Andromaca e Venere degli stracci',
                  'Bachi da setola e Giovane che guarda Lorenzo Lotto',
                ],
                correctIndex: 0,
              },
              {
                prompt: 'Quale opera del percorso è di Giorgio de Chirico?',
                answerType: 'multiple-choice',
                options: ['Ettore e Andromaca', 'Rosso Plastica', 'Bachi da setola', 'Senza titolo'],
                correctIndex: 0,
              },
              {
                prompt: 'Quale artista ha realizzato Concetto spaziale, Attese?',
                answerType: 'multiple-choice',
                options: ['Lucio Fontana', 'Emilio Vedova', 'Alberto Burri', 'Giorgio Morandi'],
                correctIndex: 0,
              },
            ],
          },
        ],
        type: 'synchronized',
        length: 'deep',
        isPublic: true,
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
