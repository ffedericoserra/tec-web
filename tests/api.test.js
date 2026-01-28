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

  // Purchase item
  {
    const { status, data } = await request('POST', `/items/${itemId}/purchase`, null, studentToken);
    // Can succeed (200), already purchased (400), or insufficient balance (400)
    const passed = status === 200 || status === 400;
    log('POST /items/:id/purchase works', passed, data.message || data.error);
    allPassed = allPassed && passed;
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
