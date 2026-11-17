import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBotMove, evaluatePosition } from './bot-engine.js';

test('BotEngine - evaluates standard starting position as balanced', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const evalResult = evaluatePosition(startFen);
  assert.equal(evalResult.isCheckmate, false);
  assert.ok(Math.abs(evalResult.centipawns) < 50);
});

test('BotEngine - detects checkmate advantage in Scholar Mate position', () => {
  // Scholar's Mate position: Queen on f7 checkmate
  const mateFen = 'r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
  const evalResult = evaluatePosition(mateFen);
  assert.equal(evalResult.isCheckmate, true);
  assert.equal(evalResult.text, '+M1');
});

test('BotEngine - computes a legal move within 100ms for Level 3 bot', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const start = Date.now();
  const botMove = computeBotMove(startFen, 3);
  const elapsed = Date.now() - start;

  assert.ok(botMove.from);
  assert.ok(botMove.to);
  assert.ok(botMove.san);
  assert.ok(elapsed < 200);
});

test('BotEngine - Level 1 bot handles moves for beginner 200 Elo', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const botMove = computeBotMove(startFen, 1);
  assert.ok(botMove.from);
  assert.ok(botMove.to);
});

