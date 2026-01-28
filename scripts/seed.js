/**
 * Database Seeding Script
 * Creates test data for ArtAround application
 *
 * Usage: npm run seed
 */

const { connectDB, disconnectDB } = require('../src/config/db');

const User = require('../src/models/User');
const Museum = require('../src/models/Museum');
const Content = require('../src/models/Content');
const Item = require('../src/models/Item');
const Visit = require('../src/models/Visit');

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
    // 2. CREATE MUSEUM
    // =====================
    const museum = await Museum.create({
      name: 'Galleria degli Uffizi',
      address: 'Piazzale degli Uffizi, 6, 50122 Firenze FI',
      description:
        'Una delle più famose gallerie d\'arte al mondo, ospita capolavori del Rinascimento italiano.',
      theme: {
        primaryColor: '#8B4513',
        secondaryColor: '#F5F5DC',
        font: 'Georgia',
      },
      mapData: {
        imageUrl: '/uploads/maps/uffizi-map.png',
        bounds: {
          north: 43.7688,
          south: 43.7676,
          east: 11.2562,
          west: 11.2546,
        },
        center: {
          lat: 43.7682,
          lng: 11.2554,
        },
      },
      pointsOfInterest: [
        { type: 'entrance', coordinates: { lat: 43.7677, lng: 11.2554 }, label: 'Ingresso principale' },
        { type: 'toilet', coordinates: { lat: 43.7680, lng: 11.2558 }, label: 'Bagni Piano Terra' },
        { type: 'toilet', coordinates: { lat: 43.7685, lng: 11.2550 }, label: 'Bagni Primo Piano' },
        { type: 'bar', coordinates: { lat: 43.7687, lng: 11.2555 }, label: 'Caffetteria Terrazza' },
        { type: 'shop', coordinates: { lat: 43.7678, lng: 11.2552 }, label: 'Bookshop' },
        { type: 'exit', coordinates: { lat: 43.7686, lng: 11.2548 }, label: 'Uscita secondaria' },
        { type: 'stairs', coordinates: { lat: 43.7681, lng: 11.2556 }, label: 'Scale principali' },
      ],
      imageUrl: '/uploads/museums/uffizi.jpg',
    });
    console.log(`Created museum: ${museum.name}`);

    // =====================
    // 3. CREATE CONTENTS
    // =====================
    const artworksData = [
      {
        type: 'Artwork',
        name: 'La nascita di Venere',
        author: 'Sandro Botticelli',
        year: '1485',
        coordinates: { lat: 43.7683, lng: 11.2553 },
        universalId: 'uffizi-botticelli-venere',
      },
      {
        type: 'Artwork',
        name: 'La Primavera',
        author: 'Sandro Botticelli',
        year: '1482',
        coordinates: { lat: 43.7683, lng: 11.2555 },
        universalId: 'uffizi-botticelli-primavera',
      },
      {
        type: 'Artwork',
        name: 'Annunciazione',
        author: 'Leonardo da Vinci',
        year: '1472',
        coordinates: { lat: 43.7684, lng: 11.2551 },
        universalId: 'uffizi-leonardo-annunciazione',
      },
      {
        type: 'Artwork',
        name: 'Tondo Doni',
        author: 'Michelangelo Buonarroti',
        year: '1507',
        coordinates: { lat: 43.7685, lng: 11.2554 },
        universalId: 'uffizi-michelangelo-tondodoni',
      },
      {
        type: 'Artwork',
        name: 'Madonna del Cardellino',
        author: 'Raffaello Sanzio',
        year: '1506',
        coordinates: { lat: 43.7682, lng: 11.2552 },
        universalId: 'uffizi-raffaello-cardellino',
      },
      {
        type: 'Artwork',
        name: 'Venere di Urbino',
        author: 'Tiziano Vecellio',
        year: '1538',
        coordinates: { lat: 43.7681, lng: 11.2556 },
        universalId: 'uffizi-tiziano-venere',
      },
      {
        type: 'Artwork',
        name: 'Bacco',
        author: 'Caravaggio',
        year: '1597',
        coordinates: { lat: 43.7680, lng: 11.2553 },
        universalId: 'uffizi-caravaggio-bacco',
      },
      {
        type: 'Artwork',
        name: 'Medusa',
        author: 'Caravaggio',
        year: '1597',
        coordinates: { lat: 43.7680, lng: 11.2555 },
        universalId: 'uffizi-caravaggio-medusa',
      },
      {
        type: 'Artwork',
        name: 'Adorazione dei Magi',
        author: 'Gentile da Fabriano',
        year: '1423',
        coordinates: { lat: 43.7684, lng: 11.2557 },
        universalId: 'uffizi-gentile-magi',
      },
      {
        type: 'Artwork',
        name: 'Maestà di Ognissanti',
        author: 'Giotto',
        year: '1310',
        coordinates: { lat: 43.7686, lng: 11.2551 },
        universalId: 'uffizi-giotto-maesta',
      },
      {
        type: 'Artist',
        name: 'Sandro Botticelli',
        year: '1445-1510',
        coordinates: { lat: 43.7683, lng: 11.2554 },
        universalId: 'uffizi-artist-botticelli',
      },
      {
        type: 'Artist',
        name: 'Leonardo da Vinci',
        year: '1452-1519',
        coordinates: { lat: 43.7684, lng: 11.2552 },
        universalId: 'uffizi-artist-leonardo',
      },
      {
        type: 'Movement',
        name: 'Rinascimento Fiorentino',
        year: 'XV-XVI secolo',
        coordinates: { lat: 43.7682, lng: 11.2554 },
        universalId: 'uffizi-movement-rinascimento',
      },
    ];

    const contents = await Content.create(
      artworksData.map((art) => ({
        ...art,
        museumId: museum._id,
        qrCode: `QR-${art.universalId}`,
      }))
    );
    console.log(`Created ${contents.length} contents`);

    // =====================
    // 4. CREATE ITEMS
    // =====================
    const createDescriptions = (contentName, contentAuthor = '') => {
      const authorText = contentAuthor ? ` di ${contentAuthor}` : '';

      return [
        {
          tone: 'easy',
          texts: [
            {
              text: `Guarda che bello!`,
              lengthCategory: '3s',
              language: 'it',
            },
            {
              text: `Questo quadro bellissimo si chiama ${contentName}. Vedi tutti questi colori? L'artista ha dipinto con tanto amore!`,
              lengthCategory: '15s',
              language: 'it',
            },
            {
              text: `Ciao amico! Questo è ${contentName}${authorText}. È come un grande libro di favole fatto di colori! Vedi le persone nel quadro? Stanno raccontando una storia. L'artista era bravissimo a usare i pennelli, come quando tu fai i disegni più belli. Che colore ti piace di più?`,
              lengthCategory: '45s',
              language: 'it',
            },
          ],
        },
        {
          tone: 'medium',
          texts: [
            {
              text: `Wow, guarda${authorText}! È ${contentName}!`,
              lengthCategory: '3s',
              language: 'it',
            },
            {
              text: `Questa è ${contentName}${authorText}. Un'opera che ha fatto la storia! Osserva i colori e le forme: non ti sembrano magici?`,
              lengthCategory: '15s',
              language: 'it',
            },
            {
              text: `Benvenuto davanti a ${contentName}${authorText}! Quest'opera è come una finestra su un mondo lontano. L'artista ha usato tecniche incredibili per creare qualcosa di unico. Nota come la luce gioca sui personaggi e come ogni dettaglio racconta una storia.`,
              lengthCategory: '45s',
              language: 'it',
            },
          ],
        },
        {
          tone: 'complex',
          texts: [
            {
              text: `${contentName}${authorText}.`,
              lengthCategory: '3s',
              language: 'it',
            },
            {
              text: `L'opera ${contentName}${authorText} rappresenta un esempio significativo del periodo rinascimentale italiano, caratterizzato da innovazioni tecniche e tematiche.`,
              lengthCategory: '15s',
              language: 'it',
            },
            {
              text: `${contentName}${authorText} costituisce uno dei vertici dell'arte rinascimentale. L'opera si distingue per la raffinata esecuzione tecnica, la sapiente composizione spaziale e l'uso magistrale del colore. La scena rappresentata riflette i valori estetici e culturali dell'epoca, integrando elementi simbolici e riferimenti alla tradizione classica.`,
              lengthCategory: '45s',
              language: 'it',
            },
          ],
        },
      ];
    };

    const items = [];
    for (const content of contents.filter((c) => c.type === 'Artwork')) {
      const item = await Item.create({
        contentId: content.universalId,
        creatorId: autore._id,
        targetAudience: 'tourist',
        descriptions: createDescriptions(content.name, content.author),
        price: Math.floor(Math.random() * 10) * 5, // 0, 5, 10, ... 45
        license: 'CC-BY',
        isPublic: true,
      });
      items.push(item);
    }
    console.log(`Created ${items.length} items`);

    // =====================
    // 5. CREATE VISITS
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
      {
        title: 'Capolavori del Rinascimento',
        museumId: museum._id,
        creatorId: autore._id,
        description:
          'Un percorso attraverso i più grandi capolavori del Rinascimento fiorentino, da Botticelli a Michelangelo.',
        sequence: createVisitSequence(items, 0, 10),
        type: 'standard',
        length: 'deep',
        isPublic: true,
        imageUrl: '/uploads/visits/rinascimento.jpg',
      },
      {
        title: 'Botticelli e i suoi contemporanei',
        museumId: museum._id,
        creatorId: autore._id,
        description:
          'Esplora l\'arte di Botticelli e degli artisti che hanno condiviso la sua epoca.',
        sequence: createVisitSequence(items, 0, 5),
        type: 'standard',
        length: 'quick',
        isPublic: true,
        imageUrl: '/uploads/visits/botticelli.jpg',
      },
      {
        title: 'Visita guidata scuole',
        museumId: museum._id,
        creatorId: docente._id,
        description:
          'Percorso didattico per gruppi scolastici con quiz finale.',
        sequence: createVisitSequence(items, 2, 8),
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
    ]);
    console.log(`Created ${visits.length} visits`);

    // Link visits to users
    autore.myVisits.push(visits[0]._id, visits[1]._id);
    docente.myVisits.push(visits[2]._id);
    visitatore.savedMuseums.push(museum._id);

    await Promise.all([autore.save(), docente.save(), visitatore.save()]);
    console.log('Updated user references');

    // =====================
    // SUMMARY
    // =====================
    console.log('\n=== SEED COMPLETE ===');
    console.log(`Users: ${users.length}`);
    console.log(`  - autore1 (password: 12345678)`);
    console.log(`  - visitatore1 (password: 12345678)`);
    console.log(`  - docente1 (password: 12345678)`);
    console.log(`Museums: 1`);
    console.log(`  - ${museum.name}`);
    console.log(`Contents: ${contents.length}`);
    console.log(`Items: ${items.length}`);
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
