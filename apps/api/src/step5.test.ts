import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from './server.js';
import { InMemoryUserRepository } from './auth/user-repository.js';

describe('Step 5: Challenges & Matchmaking API', () => {
  it('creates an open challenge with cryptographic token and 6-char short code', async () => {
    const app = buildServer(new InMemoryUserRepository());

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/challenges',
      payload: {
        creatorUsername: 'Morphy',
        timeControl: '5+0',
        side: 'white',
        rated: true,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.challenge.token.length >= 32);
    assert.equal(body.challenge.shortCode.length, 6);
    assert.equal(body.challenge.status, 'open');
    assert.equal(body.challenge.timeControl, '5+0');

    // Retrieve by token
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/challenges/${body.challenge.token}`,
    });
    assert.equal(getRes.statusCode, 200);

    // Accept challenge
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/challenges/${body.challenge.token}/accept`,
      payload: {
        username: 'Anderssen',
      },
    });
    assert.equal(acceptRes.statusCode, 200);
    const acceptBody = JSON.parse(acceptRes.body);
    assert.ok(acceptBody.gameId.startsWith('game_'));
    assert.equal(acceptBody.challenge.status, 'accepted');
    assert.equal(acceptBody.challenge.whitePlayer.username, 'Morphy');
    assert.equal(acceptBody.challenge.blackPlayer.username, 'Anderssen');

    await app.close();
  });

  it('joins matchmaking queue and pairs two players with expanding rating range', async () => {
    const app = buildServer(new InMemoryUserRepository());

    const p1Res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      payload: {
        userId: 'u_1',
        username: 'Kasparov',
        timeControl: '3+0',
        rating: 1600,
      },
    });
    assert.equal(p1Res.statusCode, 200);
    const p1Body = JSON.parse(p1Res.body);
    assert.equal(p1Body.status, 'queued');

    const p2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      payload: {
        userId: 'u_2',
        username: 'Karpov',
        timeControl: '3+0',
        rating: 1620,
      },
    });
    assert.equal(p2Res.statusCode, 200);
    const p2Body = JSON.parse(p2Res.body);
    assert.equal(p2Body.status, 'matched');
    assert.ok(p2Body.gameId);

    // Now verify p1 polling status reports matched
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/matchmaking/status?userId=u_1',
    });
    assert.equal(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.body);
    assert.equal(statusBody.status, 'matched');
    assert.equal(statusBody.gameId, p2Body.gameId);

    await app.close();
  });
});

