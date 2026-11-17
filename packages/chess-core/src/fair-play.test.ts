import { test } from 'node:test';
import assert from 'node:assert';
import {
  classifyCentipawnLoss,
  computeAverageCentipawnLoss,
  calculateAccuracyPercentage,
  analyzeMoveTimeDistribution,
  analyzeGameMoves,
} from './fair-play.js';

test('FairPlay - classifies move quality brackets correctly', () => {
  assert.strictEqual(classifyCentipawnLoss(5), 'best');
  assert.strictEqual(classifyCentipawnLoss(25), 'excellent');
  assert.strictEqual(classifyCentipawnLoss(50), 'good');
  assert.strictEqual(classifyCentipawnLoss(120), 'inaccuracy');
  assert.strictEqual(classifyCentipawnLoss(250), 'mistake');
  assert.strictEqual(classifyCentipawnLoss(450), 'blunder');
});

test('FairPlay - computes ACPL and accuracy percentage', () => {
  const losses = [0, 10, 20, 30, 40];
  const acpl = computeAverageCentipawnLoss(losses);
  assert.strictEqual(acpl, 20);

  const accHigh = calculateAccuracyPercentage(10);
  const accLow = calculateAccuracyPercentage(150);
  assert.ok(accHigh > 90, `High accuracy should exceed 90%, got ${accHigh}`);
  assert.ok(accLow < 60, `Low accuracy should be under 60%, got ${accLow}`);
});

test('FairPlay - detects unnatural robotic move-time cadence', () => {
  const naturalTimes = [800, 2500, 1200, 6000, 400, 3100, 1500, 2200, 900, 4500];
  const naturalResult = analyzeMoveTimeDistribution(naturalTimes);
  assert.strictEqual(naturalResult.isUnnaturalCadence, false);

  const roboticTimes = Array(20).fill(2500).map((t, idx) => t + (idx % 2 === 0 ? 20 : -20));
  const roboticResult = analyzeMoveTimeDistribution(roboticTimes);
  assert.strictEqual(roboticResult.isUnnaturalCadence, true);
});

test('FairPlay - analyzes game moves and produces move breakdown', () => {
  // Scholar's mate moves: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
  const moves = [
    { from: 'e2', to: 'e4' },
    { from: 'e7', to: 'e5' },
    { from: 'f1', to: 'c4' },
    { from: 'b8', to: 'c6' },
    { from: 'd1', to: 'h5' },
    { from: 'g8', to: 'f6' }, // Blunder allowing Qxf7#
    { from: 'h5', to: 'f7' },
  ];

  const report = analyzeGameMoves(moves);
  assert.strictEqual(report.whiteMoveCount, 4);
  assert.strictEqual(report.blackMoveCount, 3);
  assert.strictEqual(report.moveAnalyses.length, 7);

  const finalMove = report.moveAnalyses[6];
  assert.strictEqual(finalMove.san, 'Qxf7#');
  assert.strictEqual(finalMove.turn, 'w');
  assert.strictEqual(finalMove.classification, 'best');
});

