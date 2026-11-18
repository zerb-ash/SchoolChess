import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFideElo, calculateGlicko1, calculateGlicko2, calculateTriRating } from './index.js';

test('FIDE Elo - basic win against equal opponent', () => {
  const playerA = { rating: 1600, gamesPlayed: 40 };
  const playerB = { rating: 1600, gamesPlayed: 40 };
  
  // Win (1.0) with K=20
  const result = calculateFideElo(playerA, playerB, 1.0);
  assert.equal(result.ratingDelta, 10);
  assert.equal(result.newRating, 1610);
  assert.equal(result.isProvisional, false);
});

test('FIDE Elo - provisional player has K=40', () => {
  const playerA = { rating: 1500, gamesPlayed: 10 };
  const playerB = { rating: 1500, gamesPlayed: 50 };

  const result = calculateFideElo(playerA, playerB, 1.0);
  assert.equal(result.ratingDelta, 20);
  assert.equal(result.newRating, 1520);
  assert.equal(result.isProvisional, true);
});

test('FIDE Elo - rating floor is respected at 100', () => {
  const playerA = { rating: 102, gamesPlayed: 50 };
  const playerB = { rating: 102, gamesPlayed: 50 };

  // Loss (0.0) against equal opponent -> delta = 20 * (0 - 0.5) = -10
  // 102 - 10 = 92, which should clamp to 100
  const result = calculateFideElo(playerA, playerB, 0.0);
  assert.equal(result.newRating, 100); // Clamped to floor
  assert.equal(result.ratingDelta, -2); // Only dropped by 2
});

test('Glicko-1 - win increases rating and decreases uncertainty', () => {
  const player = { rating: 1500, rd: 200 };
  const opponent = { rating: 1500, rd: 200 };

  const result = calculateGlicko1(player, opponent, 1.0);
  assert.ok(result.newRating > 1500, 'Rating should increase after win');
  assert.ok(result.newRd! < 200, 'RD should decrease after game');
});

test('Glicko-2 - canonical update and volatility convergence', () => {
  const player = { rating: 1500, rd: 200, volatility: 0.06 };
  const opponent = { rating: 1400, rd: 30, volatility: 0.06 };

  const result = calculateGlicko2(player, opponent, 1.0);
  assert.ok(result.newRating > 1500, 'Rating should increase');
  assert.ok(result.newRd! < 200, 'RD should decrease');
  assert.ok(typeof result.newVolatility === 'number');
});

test('Tri-Rating Engine executes all 3 models in sub-millisecond time (< 0.5ms)', () => {
  const white = {
    fide: { rating: 1600, gamesPlayed: 35 },
    chessCom: { rating: 1650, rd: 80 },
    lichess: { rating: 1720, rd: 75, volatility: 0.059 }
  };
  const black = {
    fide: { rating: 1620, gamesPlayed: 45 },
    chessCom: { rating: 1640, rd: 70 },
    lichess: { rating: 1710, rd: 65, volatility: 0.058 }
  };

  const triResult = calculateTriRating(white, black, 1.0);

  // Assert all calculations completed
  assert.ok(triResult.white.fide.ratingDelta > 0);
  assert.ok(triResult.black.fide.ratingDelta < 0);
  assert.ok(triResult.white.chessCom.ratingDelta > 0);
  assert.ok(triResult.black.chessCom.ratingDelta < 0);
  assert.ok(triResult.white.lichess.ratingDelta > 0);
  assert.ok(triResult.black.lichess.ratingDelta < 0);

  // Check sub-millisecond execution constraint!
  assert.ok(triResult.durationMs < 0.5, `Execution took ${triResult.durationMs}ms, should be sub-millisecond`);
});
