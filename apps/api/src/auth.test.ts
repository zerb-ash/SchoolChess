import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from './server.js';
import { InMemoryUserRepository } from './auth/user-repository.js';

test('Auth API - User Registration with ratings seeding', async () => {
  const repo = new InMemoryUserRepository();
  const app = buildServer(repo);

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username: 'Magnus_Carlsen',
      password: 'validPassword123!',
    },
  });

  assert.equal(res.statusCode, 201);
  const data = JSON.parse(res.body);
  assert.equal(data.username, 'magnus_carlsen'); // normalized to lowercase
  assert.ok(data.id);

  // Assert session cookie set
  const cookies = res.cookies;
  const sessionCookie = cookies.find((c) => c.name === 'schoolchess_session');
  assert.ok(sessionCookie);
  assert.equal(sessionCookie.httpOnly, true);
  assert.equal(sessionCookie.sameSite, 'Lax');

  // Assert ratings were seeded for all 3 systems
  const ratings = await repo.getUserRatings(data.id);
  assert.equal(ratings.length, 12); // 3 systems * 4 categories
  const fideBlitz = ratings.find((r) => r.system === 'fide' && r.category === 'blitz');
  assert.ok(fideBlitz);
  assert.equal(fideBlitz.rating, 1400); // FIDE default floor
});

test('Auth API - Rejects invalid username formatting', async () => {
  const repo = new InMemoryUserRepository();
  const app = buildServer(repo);

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username: 'bad username with spaces',
      password: 'validPassword123!',
    },
  });

  assert.equal(res.statusCode, 400);
  const data = JSON.parse(res.body);
  assert.equal(data.error, 'VALIDATION_ERROR');
});

test('Auth API - Rejects password longer than 72 bytes (DoS protection)', async () => {
  const repo = new InMemoryUserRepository();
  const app = buildServer(repo);

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username: 'hikaru',
      password: 'a'.repeat(73),
    },
  });

  assert.equal(res.statusCode, 400);
});

test('Auth API - Enforces 16KB hard body limit', async () => {
  const repo = new InMemoryUserRepository();
  const app = buildServer(repo);

  // Create a payload larger than 16KB (16384 bytes)
  const hugePayload = {
    username: 'bloat_tester',
    password: 'password123',
    bloatData: 'x'.repeat(20000),
  };

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: hugePayload,
  });

  // Fastify returns 413 Payload Too Large
  assert.equal(res.statusCode, 413);
});

test('Auth API - Login, /me, and Logout lifecycle', async () => {
  const repo = new InMemoryUserRepository();
  const app = buildServer(repo);

  // 1. Register
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username: 'chess_master',
      password: 'strongPassword99',
    },
  });

  // 2. Login
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      username: 'CHESS_MASTER', // Case-insensitive test
      password: 'strongPassword99',
    },
  });

  assert.equal(loginRes.statusCode, 200);
  const cookieHeader = loginRes.headers['set-cookie'] as string;
  assert.ok(cookieHeader);

  // 3. Query /me
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      cookie: cookieHeader,
    },
  });

  assert.equal(meRes.statusCode, 200);
  const meData = JSON.parse(meRes.body);
  assert.equal(meData.username, 'chess_master');
  assert.equal(meData.ratings.length, 12);

  // 4. Logout
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: {
      cookie: cookieHeader,
    },
  });
  assert.equal(logoutRes.statusCode, 200);

  // 5. Subsequent /me is unauthorized
  const postLogoutMe = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      cookie: cookieHeader,
    },
  });
  assert.equal(postLogoutMe.statusCode, 401);
});

