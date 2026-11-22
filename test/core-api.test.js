const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { after, before, test } = require('node:test');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

let mongod;
let temporaryRoot;
let server;
let baseUrl;
let disconnectDatabase;
let User;
let Worker;

async function getFreePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForMongo(port, child) {
  const deadline = Date.now() + 15000;
  let spawnError;
  let output = '';
  child.once('error', (error) => { spawnError = error; });
  child.stdout?.on('data', (chunk) => { output = `${output}${chunk}`.slice(-2000); });
  child.stderr?.on('data', (chunk) => { output = `${output}${chunk}`.slice(-2000); });
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`mongod exited before startup (code ${child.exitCode}).`);
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`mongod did not start within 15 seconds. Set MONGOD_BINARY if it is not on PATH. ${output}`);
}

function findMongodBinary() {
  if (process.env.MONGOD_BINARY) return process.env.MONGOD_BINARY;
  if (process.platform === 'win32') {
    const fromPath = spawnSync('where.exe', ['mongod'], { encoding: 'utf8', windowsHide: true });
    if (fromPath.status === 0 && fromPath.stdout.trim()) return fromPath.stdout.trim().split(/\r?\n/)[0];
    const installRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
    try {
      const versions = fsSync.readdirSync(installRoot)
        .filter((version) => /^\d+(?:\.\d+)*$/.test(version))
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
      for (const version of versions) {
        const candidate = path.join(installRoot, version, 'bin', 'mongod.exe');
        if (fsSync.existsSync(candidate)) return candidate;
      }
    } catch {
      // Fall through to PATH for custom MongoDB installations.
    }
  }
  return 'mongod';
}

function captureCookie(response, session) {
  const rawCookie = response.headers.get('set-cookie');
  if (rawCookie?.startsWith('truconnect.sid=;')) {
    session.cookie = '';
    return;
  }
  if (rawCookie) session.cookie = rawCookie.split(';', 1)[0];
}

async function request(route, { method = 'GET', session, csrf, body } = {}) {
  const headers = new Headers();
  if (session?.cookie) headers.set('cookie', session.cookie);
  if (csrf) headers.set('x-csrf-token', csrf);
  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('content-type', 'application/json');
    requestBody = JSON.stringify(body);
  }
  const url = /^https?:\/\//i.test(route) ? route : `${baseUrl}${route}`;
  const response = await fetch(url, { method, headers, body: requestBody });
  if (session) captureCookie(response, session);
  return response;
}

async function readJson(response) {
  return response.json();
}

async function csrfFor(session) {
  const response = await request('/api/v1/auth/csrf', { session });
  assert.equal(response.status, 200);
  return (await readJson(response)).data.csrfToken;
}

async function register({ fullName, email, role, location = 'Accra' }) {
  const session = { cookie: '' };
  const csrf = await csrfFor(session);
  const response = await request('/api/v1/auth/register', {
    method: 'POST',
    session,
    csrf,
    body: { fullName, email, role, location, password: 'TruConnect-test-password-123!' },
  });
  const payload = await readJson(response);
  assert.equal(response.status, 201, payload.error?.message);
  session.csrf = payload.data.csrfToken;
  return { session, user: payload.data.user };
}

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'truconnect-integration-'));
  const dbPath = path.join(temporaryRoot, 'db');
  const uploadPath = path.join(temporaryRoot, 'private-verification');
  await fs.mkdir(dbPath, { recursive: true });
  const port = await getFreePort();

  process.env.NODE_ENV = 'test';
  process.env.PORT = '3000';
  process.env.SESSION_SECRET = 'truconnect-integration-test-secret-value-32-bytes';
  process.env.TRUCONNECT_PRIVATE_UPLOAD_DIR = uploadPath;
  process.env.MONGODB_URI = `mongodb://127.0.0.1:${port}/truconnect_integration?directConnection=true`;

  mongod = spawn(findMongodBinary(), [
    '--dbpath', dbPath,
    '--bind_ip', '127.0.0.1',
    '--port', String(port),
    '--quiet',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await waitForMongo(port, mongod);

  const database = require('../src/config/database');
  disconnectDatabase = database.disconnectDatabase;
  await database.connectDatabase();
  ({ User, Worker } = require('../src/models'));

  const app = require('../src/app')();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (disconnectDatabase) await disconnectDatabase();
  if (mongod && mongod.exitCode === null) {
    mongod.kill('SIGINT');
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      mongod.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
  }
  if (temporaryRoot) {
    const resolved = path.resolve(temporaryRoot);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('truconnect-integration-')) {
      throw new Error('Refusing to remove a path outside the dedicated TruConnect test directory.');
    }
    await fs.rm(resolved, { recursive: true, force: true });
  }
});

test('core customer, worker, verification, review, report, and admin flows', async () => {
  const ready = await request('/api/v1/health/ready');
  assert.equal(ready.status, 200);
  assert.equal((await readJson(ready)).database, 'connected');

  const categoriesResponse = await request('/api/v1/categories');
  assert.equal(categoriesResponse.status, 200);
  const categories = (await readJson(categoriesResponse)).data;
  assert.ok(categories.length > 0);

  const workerAccount = await register({ fullName: 'Test Worker', email: 'worker@example.test', role: 'worker' });
  const customerAccount = await register({ fullName: 'Test Customer', email: 'customer@example.test', role: 'customer' });

  const duplicateSession = { cookie: '' };
  const duplicateCsrf = await csrfFor(duplicateSession);
  const duplicate = await request('/api/v1/auth/register', {
    method: 'POST', session: duplicateSession, csrf: duplicateCsrf,
    body: { fullName: 'Duplicate User', email: 'worker@example.test', role: 'customer', password: 'TruConnect-test-password-123!' },
  });
  assert.equal(duplicate.status, 409);

  const loginSession = { cookie: '' };
  const loginCsrf = await csrfFor(loginSession);
  const loginResponse = await request('/api/v1/auth/login', {
    method: 'POST', session: loginSession, csrf: loginCsrf,
    body: { email: 'worker@example.test', password: 'TruConnect-test-password-123!' },
  });
  assert.equal(loginResponse.status, 200);
  assert.equal((await readJson(loginResponse)).data.user.role, 'worker');
  assert.equal((await request('/dashboard-worker.html', { session: loginSession })).status, 200);
  assert.equal((await request('/dashboard-admin.html', { session: loginSession })).status, 403);
  const logoutCsrf = await csrfFor(loginSession);
  const logoutResponse = await request('/api/v1/auth/logout', { method: 'POST', session: loginSession, csrf: logoutCsrf });
  assert.equal(logoutResponse.status, 200);
  const loggedOutProfile = await request('/api/v1/workers/me');
  assert.equal(loggedOutProfile.status, 401, await loggedOutProfile.text());

  const workerMeResponse = await request('/api/v1/workers/me', { session: workerAccount.session });
  assert.equal(workerMeResponse.status, 200);
  const workerProfile = (await readJson(workerMeResponse)).data;
  assert.equal(workerProfile.verificationStatus, 'unverified');

  const updateProfileCsrf = await csrfFor(workerAccount.session);
  const updateProfile = await request('/api/v1/workers/me', {
    method: 'PUT', session: workerAccount.session, csrf: updateProfileCsrf,
    body: {
      categories: [categories[0]._id], skills: ['Wiring', 'Repairs'], experienceYears: 6,
      description: 'Electrical repair and installation services.',
      location: { city: 'Accra', region: 'Greater Accra' }, phone: '+233 20 000 0000',
      whatsapp: '+233 20 000 0000', availability: 'available',
    },
  });
  assert.equal(updateProfile.status, 200, (await readJson(updateProfile)).error?.message);

  const publicSearch = await request('/api/v1/workers?q=Test%20Worker');
  assert.equal(publicSearch.status, 200);
  const searchResult = (await readJson(publicSearch)).data;
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].phone, undefined);
  assert.equal(searchResult[0].whatsapp, undefined);
  assert.equal(searchResult[0].availability, 'available');

  const availableSearch = await request('/api/v1/workers?availability=available');
  assert.equal((await readJson(availableSearch)).meta.total, 1);
  const unavailableSearch = await request('/api/v1/workers?availability=unavailable');
  assert.equal((await readJson(unavailableSearch)).meta.total, 0);

  const publicProfileResponse = await request(`/api/v1/workers/${workerProfile._id}`);
  assert.equal(publicProfileResponse.status, 200);
  const publicProfile = (await readJson(publicProfileResponse)).data;
  assert.equal(publicProfile.phone, '+233 20 000 0000');
  assert.equal(publicProfile.whatsapp, '+233 20 000 0000');

  const forbiddenDashboard = await request('/api/v1/admin/metrics', { session: customerAccount.session });
  assert.equal(forbiddenDashboard.status, 403);

  const reviewCsrf = await csrfFor(customerAccount.session);
  const submittedReview = await request(`/api/v1/workers/${workerProfile._id}/reviews`, {
    method: 'POST', session: customerAccount.session, csrf: reviewCsrf,
    body: { rating: 5, body: 'Excellent service and clear communication.' },
  });
  assert.equal(submittedReview.status, 201);
  const reviewId = (await readJson(submittedReview)).data.id;
  const duplicateReviewCsrf = await csrfFor(customerAccount.session);
  const duplicateReview = await request(`/api/v1/workers/${workerProfile._id}/reviews`, {
    method: 'POST', session: customerAccount.session, csrf: duplicateReviewCsrf,
    body: { rating: 4, body: 'A second review for the same professional.' },
  });
  assert.equal(duplicateReview.status, 409);

  const reportCsrf = await csrfFor(customerAccount.session);
  const submittedReport = await request(`/api/v1/workers/${workerProfile._id}/reports`, {
    method: 'POST', session: customerAccount.session, csrf: reportCsrf,
    body: { reason: 'other', details: 'This is an integration test report.' },
  });
  assert.equal(submittedReport.status, 201);
  const reportId = (await readJson(submittedReport)).data.id;

  const verificationCsrf = await csrfFor(workerAccount.session);
  const documents = new FormData();
  documents.append('evidenceSummary', 'Integration test certificate.');
  documents.append('documents', new Blob(['%PDF-1.4\nTest certificate\n%%EOF'], { type: 'application/pdf' }), 'certificate.pdf');
  const submittedVerification = await request('/api/v1/workers/me/verification', {
    method: 'POST', session: workerAccount.session, csrf: verificationCsrf, body: documents,
  });
  assert.equal(submittedVerification.status, 201, (await readJson(submittedVerification)).error?.message);

  const worker = await Worker.findById(workerProfile._id).exec();
  assert.equal(worker.verificationStatus, 'pending');

  const adminUser = await User.findById(customerAccount.user.id).exec();
  adminUser.role = 'admin';
  await adminUser.save();

  const metricsResponse = await request('/api/v1/admin/metrics', { session: customerAccount.session });
  assert.equal(metricsResponse.status, 200);
  const metrics = (await readJson(metricsResponse)).data;
  assert.equal(metrics.workers, 1);
  assert.equal(metrics.pendingVerifications, 1);
  assert.equal(metrics.openReports, 1);
  assert.equal((await request('/dashboard-admin.html', { session: customerAccount.session })).status, 200);

  const categoryCsrf = await csrfFor(customerAccount.session);
  const createCategory = await request('/api/v1/admin/categories', {
    method: 'POST', session: customerAccount.session, csrf: categoryCsrf,
    body: { name: 'Integration Services', slug: 'integration-services', description: 'Temporary integration test category.' },
  });
  assert.equal(createCategory.status, 201);
  const newCategory = (await readJson(createCategory)).data;
  const publicCategories = await request('/api/v1/categories');
  assert.ok((await readJson(publicCategories)).data.some((item) => item.slug === 'integration-services'));
  const deactivateCategoryCsrf = await csrfFor(customerAccount.session);
  const deactivateCategory = await request(`/api/v1/admin/categories/${newCategory._id}`, {
    method: 'PATCH', session: customerAccount.session, csrf: deactivateCategoryCsrf,
    body: { isActive: false },
  });
  assert.equal(deactivateCategory.status, 200);
  const activeCategories = await request('/api/v1/categories');
  assert.equal((await readJson(activeCategories)).data.some((item) => item.slug === 'integration-services'), false);

  const verificationList = await request('/api/v1/admin/verification-requests?status=pending', { session: customerAccount.session });
  assert.equal(verificationList.status, 200);
  const verificationData = (await readJson(verificationList)).data;
  assert.equal(verificationData.length, 1);
  const documentUrl = verificationData[0].documents[0].downloadUrl;
  assert.ok(documentUrl && !documentUrl.endsWith('/undefined'));

  const workerDocumentAccess = await request(documentUrl, { session: workerAccount.session });
  assert.equal(workerDocumentAccess.status, 403);
  const documentResponse = await request(documentUrl, { session: customerAccount.session });
  assert.equal(documentResponse.status, 200);
  assert.match(await documentResponse.text(), /^%PDF-/);

  const approveVerificationCsrf = await csrfFor(customerAccount.session);
  const approveVerification = await request(`/api/v1/admin/verification-requests/${verificationData[0]._id}`, {
    method: 'PATCH', session: customerAccount.session, csrf: approveVerificationCsrf,
    body: { status: 'approved' },
  });
  assert.equal(approveVerification.status, 200);
  assert.equal((await Worker.findById(workerProfile._id).exec()).verificationStatus, 'verified');

  const reviewList = await request('/api/v1/admin/reviews?status=pending', { session: customerAccount.session });
  const reviewRows = (await readJson(reviewList)).data;
  assert.equal(reviewRows.length, 1);
  assert.equal(String(reviewRows[0]._id), reviewId);
  const approveReviewCsrf = await csrfFor(customerAccount.session);
  const approveReview = await request(`/api/v1/admin/reviews/${reviewId}`, {
    method: 'PATCH', session: customerAccount.session, csrf: approveReviewCsrf,
    body: { moderationStatus: 'approved' },
  });
  assert.equal(approveReview.status, 200);
  const visibleReviews = await request(`/api/v1/workers/${workerProfile._id}/reviews`);
  assert.equal((await readJson(visibleReviews)).data.length, 1);

  const reportList = await request('/api/v1/admin/reports?status=open', { session: customerAccount.session });
  assert.equal((await readJson(reportList)).data[0]._id, reportId);
  const reportUpdateCsrf = await csrfFor(customerAccount.session);
  const updateReport = await request(`/api/v1/admin/reports/${reportId}`, {
    method: 'PATCH', session: customerAccount.session, csrf: reportUpdateCsrf,
    body: { status: 'resolved', resolutionNote: 'Reviewed by integration test.' },
  });
  assert.equal(updateReport.status, 200);
  const resolvedReports = await request('/api/v1/admin/reports?status=resolved', { session: customerAccount.session });
  assert.equal((await readJson(resolvedReports)).data[0].resolutionNote, 'Reviewed by integration test.');

  const selfSuspendCsrf = await csrfFor(customerAccount.session);
  const selfSuspend = await request(`/api/v1/admin/users/${customerAccount.user.id}/status`, {
    method: 'PATCH', session: customerAccount.session, csrf: selfSuspendCsrf,
    body: { accountStatus: 'suspended' },
  });
  assert.equal(selfSuspend.status, 400);

  const suspendWorkerCsrf = await csrfFor(customerAccount.session);
  const suspendWorker = await request(`/api/v1/admin/users/${workerAccount.user.id}/status`, {
    method: 'PATCH', session: customerAccount.session, csrf: suspendWorkerCsrf,
    body: { accountStatus: 'suspended' },
  });
  assert.equal(suspendWorker.status, 200);
  assert.equal((await request(`/api/v1/workers/${workerProfile._id}`)).status, 404);
  assert.equal((await request('/api/v1/workers/me', { session: workerAccount.session })).status, 401);
});
