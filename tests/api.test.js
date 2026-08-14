/**
 * ArtAround API Tests
 *
 * Run with:
 *   npm test                                    # Test localhost:8000
 *   npm test -- --prod                          # Test production
 *   API_URL=https://example.com/api npm test    # Test custom URL
 *
 * Before running tests, seed the database:
 *   npm run seed
 */

const PROD_URL = 'https://site242557.tw.cs.unibo.it/api';
const LOCAL_URL = 'http://localhost:8000/api';

const isProd = process.argv.includes('--prod');
const BASE_URL = process.env.API_URL || (isProd ? PROD_URL : LOCAL_URL);

// Test state
let authToken = null;
let teacherToken = null;
let studentToken = null;
let museumId = null;
let museumSlug = null;
let itemId = null;
let visitId = null;
let sessionCode = null;

// Helper functions
async function request(method, endpoint, body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json().catch(() => ({}));

  return { status: response.status, data };
}

function log(testName, passed, details = '') {
  const status = passed ? '✓' : '✗';
  console.log(`  ${status} ${testName}${details ? ` - ${details}` : ''}`);
}

// Test suites
async function testHealthCheck() {
  console.log('\n📍 Health Check');

  const { status, data } = await request('GET', '/health');
  const passed = status === 200 && data.status === 'ok';
  log('GET /health returns ok', passed);

  return passed;
}

async function testAuthValidation() {
  console.log('\n🔐 Auth Validation');
  let allPassed = true;

  // Test register validation - username too short
  {
    const { status, data } = await request('POST', '/auth/register', {
      username: 'ab',
      password: '123456',
    });
    const passed = status === 400 && data.error === 'Validation Error';
    log('Register rejects short username', passed);
    allPassed = allPassed && passed;
  }

  // Test register validation - password too short
  {
    const { status, data } = await request('POST', '/auth/register', {
      username: 'validuser',
      password: '123',
    });
    const passed = status === 400 && data.error === 'Validation Error';
    log('Register rejects short password', passed);
    allPassed = allPassed && passed;
  }

  // Test login with invalid credentials
  {
    const { status, data } = await request('POST', '/auth/login', {
      username: 'nonexistent',
      password: 'wrongpassword',
    });
    const passed = status === 401;
    log('Login rejects invalid credentials', passed);
    allPassed = allPassed && passed;
  }

  return allPassed;
}

async function testAuth() {
  console.log('\n🔑 Authentication');
  let allPassed = true;

  // Login as autore1
  {
    const { status, data } = await request('POST', '/auth/login', {
      username: 'autore1',
      password: '12345678',
    });
    const passed = status === 200 && data.token && data.user;
    log('Login as autore1', passed);
    if (passed) authToken = data.token;
    allPassed = allPassed && passed;
  }

  // Login as docente1
  {
    const { status, data } = await request('POST', '/auth/login', {
      username: 'docente1',
      password: '12345678',
    });
    const passed = status === 200 && data.token;
    log('Login as docente1', passed);
    if (passed) teacherToken = data.token;
    allPassed = allPassed && passed;
  }

  // Login as visitatore1
  {
    const { status, data } = await request('POST', '/auth/login', {
      username: 'visitatore1',
      password: '12345678',
    });
    const passed = status === 200 && data.token;
    log('Login as visitatore1', passed);
    if (passed) studentToken = data.token;
    allPassed = allPassed && passed;
  }

  // Get profile
  {
    const { status, data } = await request('GET', '/auth/me', null, authToken);
    const passed = status === 200 && data.user && data.user.username === 'autore1';
    log('GET /auth/me returns user profile', passed);
    allPassed = allPassed && passed;
  }

  // Get profile without token
  {
    const { status } = await request('GET', '/auth/me');
    const passed = status === 401;
    log('GET /auth/me rejects without token', passed);
    allPassed = allPassed && passed;
  }

  // Recharge wallet
  {
    const before = await request('GET', '/auth/me', null, authToken);
    const rechargeAmount = 25;
    const recharge = await request('PATCH', '/auth/wallet', { amount: rechargeAmount }, authToken);
    const after = await request('GET', '/auth/me', null, authToken);

    const previousBalance = before.data?.user?.walletBalance;
    const nextBalance = after.data?.user?.walletBalance;
    const passed =
      recharge.status === 200 &&
      typeof previousBalance === 'number' &&
      typeof nextBalance === 'number' &&
      nextBalance === previousBalance + rechargeAmount;

    log('PATCH /auth/wallet recharges balance', passed, `balance: ${previousBalance} -> ${nextBalance}`);
    allPassed = allPassed && passed;
  }

  return allPassed;
}

async function testMuseums() {
  console.log('\n🏛️  Museums');
  let allPassed = true;

  // List museums
  {
    const { status, data } = await request('GET', '/museums');
    const passed = status === 200 && Array.isArray(data.museums) && data.museums.length > 0;
    log('GET /museums returns list', passed, `${data.museums?.length || 0} museums`);
    if (passed) {
      museumId = data.museums[0]._id;
      museumSlug = data.museums[0].slug;
    }
    allPassed = allPassed && passed;
  }

  // Get museum by ID
  {
    const { status, data } = await request('GET', `/museums/${museumId}`);
    const passed = status === 200 && data.museum && data.museum._id === museumId;
    log('GET /museums/:id returns museum', passed);
    allPassed = allPassed && passed;
  }

  // Get museum by slug
  {
    const { status, data } = await request('GET', `/museums/${museumSlug}`);
    const passed = status === 200 && data.museum && data.museum.slug === museumSlug;
    log('GET /museums/:slug returns museum', passed);
    allPassed = allPassed && passed;
  }

  // Get museum contents
  {
    const { status, data } = await request('GET', `/museums/${museumId}/contents`);
    const passed = status === 200 && Array.isArray(data.contents);
    log('GET /museums/:id/contents returns contents', passed, `${data.contents?.length || 0} items`);
    allPassed = allPassed && passed;
  }

  // Get museum contents filtered by type
  {
    const { status, data } = await request('GET', `/museums/${museumId}/contents?type=Artwork`);
    const passed = status === 200 && data.contents?.every((c) => c.type === 'Artwork');
    log('GET /museums/:id/contents?type=Artwork filters correctly', passed);
    allPassed = allPassed && passed;
  }

  // Content creation requires a stable universal identifier
  {
    const { status } = await request(
      'POST',
      `/museums/${museumId}/contents`,
      { type: 'Artwork', name: 'Missing universal ID' },
      authToken
    );
    const passed = status === 400;
    log('POST /museums/:id/contents requires universalId', passed);
    allPassed = allPassed && passed;
  }

  // Get museum visits
  {
    const { status, data } = await request('GET', `/museums/${museumId}/visits`);
    const passed = status === 200 && Array.isArray(data.visits);
    log('GET /museums/:id/visits returns visits', passed, `${data.visits?.length || 0} visits`);
    if (passed && data.visits.length > 0) {
      visitId = data.visits[0]._id;
    }
    allPassed = allPassed && passed;
  }

  // Get nonexistent museum
  {
    const { status } = await request('GET', '/museums/nonexistent-museum-id');
    const passed = status === 404;
    log('GET /museums/:id returns 404 for nonexistent', passed);
    allPassed = allPassed && passed;
  }

  return allPassed;
}

async function testItems() {
  console.log('\n🎨 Items');
  let allPassed = true;

  // List public items
  {
    const { status, data } = await request('GET', '/items?isPublic=true');
    const passed = status === 200 && Array.isArray(data.items);
    log('GET /items?isPublic=true returns list', passed, `${data.items?.length || 0} items`);
    if (passed && data.items.length > 0) {
      itemId = data.items[0]._id;
    }
    allPassed = allPassed && passed;
  }

  // Get item by ID
  {
    const { status, data } = await request('GET', `/items/${itemId}`);
    const passed = status === 200 && data.item && data.item._id === itemId;
    log('GET /items/:id returns item', passed);
    allPassed = allPassed && passed;
  }

  // Get item with descriptions
  {
    const { status, data } = await request('GET', `/items/${itemId}`);
    const passed =
      status === 200 && data.item?.descriptions && Array.isArray(data.item.descriptions);
    log('GET /items/:id includes descriptions', passed);
    allPassed = allPassed && passed;
  }

  // Validate universal links and exercise the full commercial lifecycle
  {
    const contentsRes = await request('GET', `/museums/${museumId}/contents`);
    const contents = contentsRes.data?.contents || [];
    const mainContent = contents.find((content) => content.type === 'Artwork');
    const associatedContent = contents.find((content) => content._id !== mainContent?._id);
    let temporaryItemId = null;

    if (!mainContent || !associatedContent) {
      log('Item lifecycle fixture is available', false);
      allPassed = false;
    } else {
      const itemPayload = {
        contentId: mainContent.universalId,
        targetAudience: 'student',
        descriptions: [
          {
            tone: 'medium',
            texts: [
              {
                text: 'Temporary metadata test item',
                lengthCategory: '15s',
                language: 'en',
              },
            ],
          },
        ],
        price: 7,
        license: 'CC-BY-NC',
        isPublic: false,
        associatedContents: [associatedContent._id],
      };

      const invalidLink = await request(
        'POST',
        '/items',
        { ...itemPayload, contentId: mainContent._id },
        authToken
      );
      const invalidLinkPassed = invalidLink.status === 400;
      log('POST /items rejects Mongo _id as contentId', invalidLinkPassed);
      allPassed = allPassed && invalidLinkPassed;

      const createRes = await request('POST', '/items', itemPayload, authToken);
      temporaryItemId = createRes.data?.item?._id || null;
      const metadataPassed =
        createRes.status === 201 &&
        createRes.data?.item?.contentId === mainContent.universalId &&
        createRes.data?.item?.targetAudience === 'student' &&
        createRes.data?.item?.descriptions?.[0]?.texts?.[0]?.language === 'en' &&
        createRes.data?.item?.price === 7 &&
        createRes.data?.item?.license === 'CC-BY-NC' &&
        createRes.data?.item?.isPublic === false &&
        createRes.data?.item?.associatedContents?.length === 1;
      log('POST /items stores complete metadata and associations', metadataPassed);
      allPassed = allPassed && metadataPassed;

      if (temporaryItemId) {
        const anonymousList = await request(
          'GET',
          `/items?contentId=${encodeURIComponent(mainContent.universalId)}`
        );
        const studentGet = await request('GET', `/items/${temporaryItemId}`, null, studentToken);
        const ownerGet = await request('GET', `/items/${temporaryItemId}`, null, authToken);
        const privacyPassed =
          anonymousList.status === 200 &&
          !anonymousList.data.items.some((item) => item._id === temporaryItemId) &&
          studentGet.status === 403 &&
          ownerGet.status === 200;
        log('Private items are visible only to their creator', privacyPassed);
        allPassed = allPassed && privacyPassed;

        const publishRes = await request(
          'PUT',
          `/items/${temporaryItemId}`,
          { isPublic: true },
          authToken
        );
        const creatorBefore = await request('GET', '/auth/me', null, authToken);
        const buyerBefore = await request('GET', '/auth/me', null, studentToken);
        const purchaseRes = await request(
          'POST',
          `/items/${temporaryItemId}/purchase`,
          null,
          studentToken
        );
        const creatorAfter = await request('GET', '/auth/me', null, authToken);
        const buyerAfter = await request('GET', '/auth/me', null, studentToken);
        const soldItem = await request('GET', `/items/${temporaryItemId}`, null, authToken);

        const purchasePassed =
          publishRes.status === 200 &&
          purchaseRes.status === 200 &&
          purchaseRes.data.chargedAmount === 7 &&
          buyerAfter.data?.user?.walletBalance === buyerBefore.data?.user?.walletBalance - 7 &&
          creatorAfter.data?.user?.walletBalance === creatorBefore.data?.user?.walletBalance + 7 &&
          soldItem.data?.item?.salesCount === 1 &&
          soldItem.data?.item?.revenue === 7;
        log('Purchase updates wallets, sales and revenue', purchasePassed);
        allPassed = allPassed && purchasePassed;

        const repeatPurchase = await request(
          'POST',
          `/items/${temporaryItemId}/purchase`,
          null,
          studentToken
        );
        const soldItemAfterRepeat = await request(
          'GET',
          `/items/${temporaryItemId}`,
          null,
          authToken
        );
        const idempotentPassed =
          repeatPurchase.status === 200 &&
          repeatPurchase.data.chargedAmount === 0 &&
          soldItemAfterRepeat.data?.item?.salesCount === 1 &&
          soldItemAfterRepeat.data?.item?.revenue === 7;
        log('Repeated purchase is idempotent', idempotentPassed);
        allPassed = allPassed && idempotentPassed;

        const deleteRes = await request('DELETE', `/items/${temporaryItemId}`, null, authToken);
        const deletePassed = deleteRes.status === 200;
        log('DELETE /items cleans up an unreferenced sold item', deletePassed);
        allPassed = allPassed && deletePassed;
      }
    }
  }

  // Purchase without auth
  {
    const { status } = await request('POST', `/items/${itemId}/purchase`);
    const passed = status === 401;
    log('POST /items/:id/purchase requires auth', passed);
    allPassed = allPassed && passed;
  }

  return allPassed;
}

async function testVisits() {
  console.log('\n🚶 Visits');
  let allPassed = true;

  // Get visit by ID
  {
    const { status, data } = await request('GET', `/visits/${visitId}`);
    const passed = status === 200 && data.visit && data.visit._id === visitId;
    log('GET /visits/:id returns visit', passed);
    allPassed = allPassed && passed;
  }

  // Get visit includes sequence
  {
    const { status, data } = await request('GET', `/visits/${visitId}`);
    const passed = status === 200 && Array.isArray(data.visit?.sequence);
    log('GET /visits/:id includes sequence', passed, `${data.visit?.sequence?.length || 0} items`);
    allPassed = allPassed && passed;
  }

  // Get visit includes length field
  {
    const { status, data } = await request('GET', `/visits/${visitId}`);
    const validLengths = ['quick', 'normal', 'deep'];
    const passed = status === 200 && validLengths.includes(data.visit?.length);
    log('GET /visits/:id includes length', passed, data.visit?.length);
    allPassed = allPassed && passed;
  }

  // Get my visits (authenticated)
  {
    const { status, data } = await request('GET', '/visits/my', null, authToken);
    const passed = status === 200 && Array.isArray(data.visits);
    log('GET /visits/my returns user visits', passed);
    allPassed = allPassed && passed;
  }

  // Get my visits without auth
  {
    const { status } = await request('GET', '/visits/my');
    const passed = status === 401;
    log('GET /visits/my requires auth', passed);
    allPassed = allPassed && passed;
  }

  // Create and edit a visit without losing route metadata
  {
    const beforeProfile = await request('GET', '/auth/me', null, authToken);
    const contentsRes = await request('GET', `/museums/${museumId}/contents`);
    const itemsRes = await request('GET', '/items', null, authToken);

    const validContentIds = new Set(
      (contentsRes.data?.contents || []).map((content) => content.universalId)
    );

    const museumItem = (itemsRes.data?.items || []).find(
      (item) => validContentIds.has(item.contentId) && item.isOwned
    );

    let passed = false;
    let details = 'no museum item found';

    if (museumItem && typeof beforeProfile.data?.user?.walletBalance === 'number') {
      const payload = {
        title: `Temp visit ${Date.now()}`,
        museumId,
        description: 'Temporary billing test',
        sequence: [{
          itemId: museumItem._id,
          nextDirections: 'Vai alla sala seguente',
          prevDirections: 'Arriva dal corridoio principale',
        }],
        blocks: [{ blockName: 'Room I', items: [museumItem._id] }],
        isPublic: false,
        type: 'standard',
        length: 'deep',
      };

      const createRes = await request('POST', '/visits', payload, authToken);
      const afterProfile = await request('GET', '/auth/me', null, authToken);
      const tempVisitId = createRes.data?.visit?._id || null;
      const previousBalance = beforeProfile.data.user.walletBalance;
      const nextBalance = afterProfile.data?.user?.walletBalance;
      const createdVisit = tempVisitId
        ? await request('GET', `/visits/${tempVisitId}`, null, authToken)
        : { status: 0, data: {} };

      passed =
        createRes.status === 201 &&
        typeof nextBalance === 'number' &&
        createRes.data?.chargedAmount === 0 &&
        nextBalance === previousBalance &&
        createdVisit.data?.visit?.length === 'deep' &&
        createdVisit.data?.visit?.sequence?.[0]?.nextDirections === 'Vai alla sala seguente' &&
        createdVisit.data?.visit?.sequence?.[0]?.prevDirections === 'Arriva dal corridoio principale';

      details = `charged: ${createRes.data?.chargedAmount ?? 'n/a'}`;

      if (tempVisitId) {
        const updateRes = await request(
          'PUT',
          `/visits/${tempVisitId}`,
          {
            length: 'quick',
            sequence: [{
              itemId: museumItem._id,
              nextDirections: 'Svolta a destra',
              prevDirections: 'Sali le scale',
            }],
          },
          authToken
        );
        const updatedVisit = await request('GET', `/visits/${tempVisitId}`, null, authToken);
        const updatePassed =
          updateRes.status === 200 &&
          updatedVisit.data?.visit?.length === 'quick' &&
          updatedVisit.data?.visit?.sequence?.[0]?.nextDirections === 'Svolta a destra' &&
          updatedVisit.data?.visit?.sequence?.[0]?.prevDirections === 'Sali le scale';
        log('PUT /visits preserves edited length and directions', updatePassed);
        allPassed = allPassed && updatePassed;
      }

      if (tempVisitId) {
        await request('DELETE', `/visits/${tempVisitId}`, null, authToken);
      }
    }

    log('POST /visits preserves route metadata without charging owned items', passed, details);
    allPassed = allPassed && passed;
  }

  return allPassed;
}

async function testSessions() {
  console.log('\n👥 Sessions');
  let allPassed = true;

  // Create session (teacher)
  {
    const { status, data } = await request(
      'POST',
      '/sessions',
      { visitId: visitId },
      teacherToken
    );
    const passed = status === 201 && data.session && data.session.code;
    log('POST /sessions creates session', passed, data.session?.code);
    if (passed) sessionCode = data.session.code;
    allPassed = allPassed && passed;
  }

  // Create session without auth
  {
    const { status } = await request('POST', '/sessions', { visitId: visitId });
    const passed = status === 401;
    log('POST /sessions requires auth', passed);
    allPassed = allPassed && passed;
  }

  // Create session with invalid visitId
  {
    const { status } = await request(
      'POST',
      '/sessions',
      { visitId: '000000000000000000000000' },
      teacherToken
    );
    const passed = status === 400 || status === 404 || status === 500;
    log('POST /sessions validates visitId', passed, `status: ${status}`);
    allPassed = allPassed && passed;
  }

  // Get session by code
  {
    const { status, data } = await request('GET', `/sessions/${sessionCode}`, null, teacherToken);
    const passed = status === 200 && data.session && data.session.code === sessionCode;
    log('GET /sessions/:code returns session', passed);
    allPassed = allPassed && passed;
  }

  // Join session (student)
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${sessionCode}/join`,
      null,
      studentToken
    );
    const passed = status === 200 && data.session;
    log('POST /sessions/:code/join works', passed);
    allPassed = allPassed && passed;
  }

  // Log activity (student)
  {
    const { status } = await request(
      'POST',
      `/sessions/${sessionCode}/activity`,
      { action: 'tellMore' },
      studentToken
    );
    const passed = status === 200;
    log('POST /sessions/:code/activity logs action', passed);
    allPassed = allPassed && passed;
  }

  // Log invalid activity
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${sessionCode}/activity`,
      { action: 'invalidAction' },
      studentToken
    );
    const passed = status === 400 && data.error === 'Validation Error';
    log('POST /sessions/:code/activity validates action', passed);
    allPassed = allPassed && passed;
  }

  // Advance session (teacher)
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${sessionCode}/advance`,
      null,
      teacherToken
    );
    const passed = status === 200 && typeof data.currentItemIndex === 'number';
    log('POST /sessions/:code/advance works', passed, `index: ${data.currentItemIndex}`);
    allPassed = allPassed && passed;
  }

  // Advance session (student - should fail)
  {
    const { status } = await request(
      'POST',
      `/sessions/${sessionCode}/advance`,
      null,
      studentToken
    );
    const passed = status === 403;
    log('POST /sessions/:code/advance rejects non-owner', passed);
    allPassed = allPassed && passed;
  }

  // Previous session (teacher)
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${sessionCode}/previous`,
      null,
      teacherToken
    );
    const passed = status === 200 && typeof data.currentItemIndex === 'number';
    log('POST /sessions/:code/previous works', passed);
    allPassed = allPassed && passed;
  }

  // Leave session (student)
  {
    const { status } = await request(
      'POST',
      `/sessions/${sessionCode}/leave`,
      null,
      studentToken
    );
    const passed = status === 200;
    log('POST /sessions/:code/leave works', passed);
    allPassed = allPassed && passed;
  }

  // End session (teacher)
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${sessionCode}/end`,
      null,
      teacherToken
    );
    // Session might return session object or just a message
    const passed = status === 200;
    log('POST /sessions/:code/end works', passed, data.message || `isActive: ${data.session?.isActive}`);
    allPassed = allPassed && passed;
  }

  // Get my sessions
  {
    const { status, data } = await request('GET', '/sessions/my', null, teacherToken);
    const passed = status === 200 && Array.isArray(data.sessions);
    log('GET /sessions/my returns sessions', passed);
    allPassed = allPassed && passed;
  }

  return allPassed;
}

async function testQuiz() {
  console.log('\n📝 Quiz');
  let allPassed = true;
  let quizSessionCode = null;

  // Find a synchronized visit with quiz (seeded by docente1)
  let syncVisitId = null;
  {
    const { status, data } = await request('GET', '/visits/my', null, teacherToken);
    if (status === 200 && data.visits) {
      const syncVisit = data.visits.find((v) => v.type === 'synchronized' && v.quiz && v.quiz.length > 0);
      if (syncVisit) syncVisitId = syncVisit._id;
    }
    const passed = !!syncVisitId;
    log('Found synchronized visit with quiz', passed);
    allPassed = allPassed && passed;
  }

  if (!syncVisitId) {
    console.log('  ⚠ Skipping quiz tests (no sync visit with quiz found)');
    return allPassed;
  }

  // Create session for quiz visit
  {
    const { status, data } = await request(
      'POST',
      '/sessions',
      { visitId: syncVisitId },
      teacherToken
    );
    const passed = status === 201 && data.session?.code;
    log('Create session for quiz visit', passed);
    if (passed) quizSessionCode = data.session.code;
    allPassed = allPassed && passed;
  }

  // Student joins session
  {
    const { status } = await request(
      'POST',
      `/sessions/${quizSessionCode}/join`,
      null,
      studentToken
    );
    const passed = status === 200;
    log('Student joins quiz session', passed);
    allPassed = allPassed && passed;
  }

  // Submit quiz (student)
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${quizSessionCode}/quiz`,
      {
        answers: [
          { questionIndex: 0, selectedIndex: 1 },
          { questionIndex: 1, selectedIndex: 2 },
          { questionIndex: 2, selectedIndex: 2 },
        ],
      },
      studentToken
    );
    const passed = status === 200 && typeof data.score === 'number' && typeof data.total === 'number';
    log('POST /sessions/:code/quiz submits quiz', passed, `score: ${data.score}/${data.total}`);
    allPassed = allPassed && passed;
  }

  // Submit quiz again (should fail - already submitted)
  {
    const { status, data } = await request(
      'POST',
      `/sessions/${quizSessionCode}/quiz`,
      {
        answers: [{ questionIndex: 0, selectedIndex: 0 }],
      },
      studentToken
    );
    const passed = status === 400 && data.error === 'Quiz already submitted';
    log('POST /sessions/:code/quiz rejects double submission', passed);
    allPassed = allPassed && passed;
  }

  // Get quiz results (teacher/owner)
  {
    const { status, data } = await request(
      'GET',
      `/sessions/${quizSessionCode}/quiz`,
      null,
      teacherToken
    );
    const passed = status === 200 && Array.isArray(data.results) && data.results.length > 0;
    log('GET /sessions/:code/quiz returns results (owner)', passed);
    allPassed = allPassed && passed;
  }

  // Get quiz results (student - should fail)
  {
    const { status } = await request(
      'GET',
      `/sessions/${quizSessionCode}/quiz`,
      null,
      studentToken
    );
    const passed = status === 403;
    log('GET /sessions/:code/quiz rejects non-owner', passed);
    allPassed = allPassed && passed;
  }

  // Submit quiz without auth
  {
    const { status } = await request(
      'POST',
      `/sessions/${quizSessionCode}/quiz`,
      { answers: [{ questionIndex: 0, selectedIndex: 0 }] }
    );
    const passed = status === 401;
    log('POST /sessions/:code/quiz requires auth', passed);
    allPassed = allPassed && passed;
  }

  // End the quiz session (cleanup)
  {
    await request('POST', `/sessions/${quizSessionCode}/end`, null, teacherToken);
  }

  return allPassed;
}

// Main test runner
async function runTests() {
  console.log('═══════════════════════════════════════════');
  console.log('       ArtAround API Test Suite');
  console.log('═══════════════════════════════════════════');
  console.log(`Target: ${BASE_URL}`);

  const results = {
    healthCheck: false,
    authValidation: false,
    auth: false,
    museums: false,
    items: false,
    visits: false,
    sessions: false,
    quiz: false,
  };

  try {
    results.healthCheck = await testHealthCheck();
    results.authValidation = await testAuthValidation();
    results.auth = await testAuth();

    if (!authToken) {
      console.log('\n❌ Cannot continue: Authentication failed');
      return;
    }

    results.museums = await testMuseums();
    results.items = await testItems();
    results.visits = await testVisits();
    results.sessions = await testSessions();
    results.quiz = await testQuiz();
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('                 Summary');
  console.log('═══════════════════════════════════════════');

  let passed = 0;
  let failed = 0;

  for (const [suite, result] of Object.entries(results)) {
    const status = result ? '✓' : '✗';
    console.log(`  ${status} ${suite}`);
    if (result) passed++;
    else failed++;
  }

  console.log('───────────────────────────────────────────');
  console.log(`  Total: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();
