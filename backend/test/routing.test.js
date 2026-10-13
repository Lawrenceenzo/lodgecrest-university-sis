// Tests that the API answers on the paths the deployed front end uses, and that CORS lets the deployed site in.
// No database is needed: every request here is turned away (401) before any data is read.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.CLIENT_ORIGIN = 'https://preview-one.vercel.app/, https://preview-two.vercel.app';

const app = require('../app');

async function withServer(fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

const get = (base, path, headers = {}) =>
  new Promise((resolve, reject) => {
    http.get(base + path, { headers }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    }).on('error', reject);
  });

describe('routing', () => {
  test('every admin resource answers 401 (not 404) with and without the /api prefix', async () => {
    await withServer(async (base) => {
      for (const resource of ['courses', 'subjects', 'teachers', 'sections', 'students', 'terms', 'offerings', 'pre-enrollments', 'users', 'portal/me']) {
        assert.equal((await get(base, `/api/${resource}`)).status, 401, `/api/${resource}`);
        assert.equal((await get(base, `/${resource}`)).status, 401, `/${resource}`);
      }
      assert.equal((await get(base, '/api/no-such-thing')).status, 404);
      assert.equal((await get(base, '/api/health')).status, 200);
    });
  });

  test('CORS: the deployed site and every CLIENT_ORIGIN entry are allowed (trailing slashes ignored); strangers are not', async () => {
    await withServer(async (base) => {
      const allowed = async (origin) => (await get(base, '/api/health', { Origin: origin })).headers['access-control-allow-origin'];
      assert.equal(await allowed('https://lodgecrest-university-sis.vercel.app'), 'https://lodgecrest-university-sis.vercel.app');
      assert.equal(await allowed('http://localhost:5173'), 'http://localhost:5173');
      assert.equal(await allowed('https://preview-one.vercel.app'), 'https://preview-one.vercel.app');
      assert.equal(await allowed('https://preview-two.vercel.app'), 'https://preview-two.vercel.app');
      assert.equal(await allowed('https://evil.example.com'), undefined);
      assert.equal(await allowed('https://lodgecrest-university-sis.vercel.app.evil.com'), undefined);
    });
  });

  test('CORS exposes Content-Disposition so the transcript keeps its file name', async () => {
    await withServer(async (base) => {
      const res = await get(base, '/api/health', { Origin: 'http://localhost:5173' });
      assert.match(res.headers['access-control-expose-headers'], /Content-Disposition/);
    });
  });
});
