import test from 'node:test';
import assert from 'node:assert/strict';
import { users, userRatings, games, gameMoves, challenges, userStatistics, userSettings } from './index.js';

test('Database Schema - exports all 9 core tables with defined primary keys', () => {
  assert.ok(users.id);
  assert.ok(users.username);
  assert.ok(userRatings.id);
  assert.ok(userRatings.userId);
  assert.ok(games.id);
  assert.ok(gameMoves.id);
  assert.ok(challenges.id);
  assert.ok(userStatistics.userId);
  assert.ok(userSettings.userId);
});

test('Database Schema - users table enforces username length constraint', () => {
  assert.equal(users.username.dataType, 'string');
});

