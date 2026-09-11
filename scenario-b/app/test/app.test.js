const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

let server;
let baseUrl;

before(() => {
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

test('GET /healthz returns 200 with status ok', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('GET /healthz sets X-Served-By header', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.ok(res.headers.get('x-served-by'));
});

test('GET /api/notes without X-Tenant header returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/notes`);
  assert.equal(res.status, 400);
});

test('GET /nonexistent-route returns 404', async () => {
  const res = await fetch(`${baseUrl}/nonexistent-route`);
  assert.equal(res.status, 999); // B5 Task 45 break #1 - deliberately wrong
});
