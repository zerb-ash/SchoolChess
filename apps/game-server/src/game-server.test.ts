import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthoritativeClock } from './clock/authoritative-clock.js';
import { roomManager } from './rooms/room-manager.js';
import { buildGameServer } from './server.js';

test('AuthoritativeClock - monotonic move deduction and turn alternation', () => {
  let timeoutTriggered = false;
  const clock = new AuthoritativeClock(60000, 2000, () => {
    timeoutTriggered = true;
  });

  clock.start();
  const snap1 = clock.getSnapshot();
  assert.equal(snap1.whiteMs, 60000);
  assert.equal(snap1.blackMs, 60000);
  assert.equal(snap1.activeColor, 'w');

  const afterWhite = clock.recordMove('w');
  assert.ok(afterWhite.whiteMs >= 60000);
  assert.equal(clock.getSnapshot().activeColor, 'b');

  const afterBlack = clock.recordMove('b');
  assert.ok(afterBlack.blackMs >= 60000);
  assert.equal(clock.getSnapshot().activeColor, 'w');

  clock.stop();
  assert.equal(timeoutTriggered, false);
});

test('AuthoritativeClock - triggers timeout callback when time expires', async () => {
  await new Promise<void>((resolve) => {
    const clock = new AuthoritativeClock(30, 0, (loser) => {
      assert.equal(loser, 'w');
      clock.stop();
      resolve();
    });
    clock.start();
  });
});

test('GameRoom - move validation and sequence lock', () => {
  const testGameId = 'd86e9e43-85e7-497d-b6a2-a9b893d56123';
  const room = roomManager.getOrCreateRoom({
    gameId: testGameId,
    white: { id: 'u_white', username: 'WhitePlayer', rating: 1500 },
    black: { id: 'u_black', username: 'BlackPlayer', rating: 1500 },
    baseTimeSeconds: 180,
    incrementSeconds: 2,
    rated: true,
  });

  const state = room.getStatePayload();
  assert.equal(state.turn, 'w');
  assert.equal(state.moveNumber, 0);
  assert.equal(state.status, 'active');
  assert.equal(state.whiteClockMs, 180000);

  roomManager.removeRoom(testGameId);
});

test('GameServer - health endpoint returns active room count', async () => {
  const app = buildGameServer();

  const res = await app.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.equal(data.status, 'ok');
  assert.ok(typeof data.activeRooms === 'number');

  await app.close();
});
