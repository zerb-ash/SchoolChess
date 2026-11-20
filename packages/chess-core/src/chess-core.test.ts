import test from 'node:test';
import assert from 'node:assert/strict';
import { ChessGameEngine } from './index.js';

test('ChessGameEngine - legal moves and turn alternation', () => {
  const engine = new ChessGameEngine();
  assert.equal(engine.getTurn(), 'w');

  const res1 = engine.applyMove('e2', 'e4');
  assert.equal(res1.valid, true);
  assert.equal(res1.san, 'e4');
  assert.equal(res1.uci, 'e2e4');
  assert.equal(engine.getTurn(), 'b');

  const res2 = engine.applyMove('e7', 'e5');
  assert.equal(res2.valid, true);
  assert.equal(res2.san, 'e5');
  assert.equal(engine.getTurn(), 'w');
});

test('ChessGameEngine - rejects illegal moves', () => {
  const engine = new ChessGameEngine();
  const res = engine.applyMove('e2', 'e5'); // illegal pawn jump
  assert.equal(res.valid, false);
  assert.equal(res.errorCode, 'ILLEGAL_MOVE');
  assert.equal(engine.getTurn(), 'w'); // Turn unchanged
});

test('ChessGameEngine - detects Scholar\'s Mate (Checkmate)', () => {
  const engine = new ChessGameEngine();
  engine.applyMove('e2', 'e4');
  engine.applyMove('e7', 'e5');
  engine.applyMove('d1', 'h5');
  engine.applyMove('b8', 'c6');
  engine.applyMove('f1', 'c4');
  engine.applyMove('g8', 'f6');
  
  const mateRes = engine.applyMove('h5', 'f7');
  assert.equal(mateRes.valid, true);
  assert.equal(mateRes.isGameOver, true);
  assert.equal(mateRes.result, '1-0');
  assert.equal(mateRes.termination, 'checkmate');
  assert.equal(mateRes.winnerColor, 'w');
});

test('ChessGameEngine - executes in sub-millisecond time (< 1ms)', () => {
  const engine = new ChessGameEngine();
  // JIT warm-up
  for (let i = 0; i < 20; i++) {
    engine.applyMove('e2', 'e4');
    engine.reset();
  }

  const start = performance.now();
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    engine.applyMove('e2', 'e4');
    engine.reset();
  }
  const avgDuration = (performance.now() - start) / iterations;
  assert.ok(avgDuration < 1.0, `Average move execution took ${avgDuration}ms, should be < 1.0ms`);
});

test('ChessGameEngine - hasSufficientMaterial accurately identifies mating capability', () => {
  // 1. Initial starting position - both have sufficient
  const initial = new ChessGameEngine();
  assert.equal(initial.hasSufficientMaterial('w'), true);
  assert.equal(initial.hasSufficientMaterial('b'), true);

  // 2. Lone King vs 2 Queens (the user's game: 8/K7/8/8/8/kq6/q7/8 b - - 10 81)
  const userGame = new ChessGameEngine('8/K7/8/8/8/kq6/q7/8 b - - 10 81');
  assert.equal(userGame.hasSufficientMaterial('w'), false, 'White lone king has insufficient material');
  assert.equal(userGame.hasSufficientMaterial('b'), true, 'Black has 2 queens so has sufficient material');

  // 3. King + Knight vs King
  const knightVsKing = new ChessGameEngine('8/8/8/8/8/k7/8/K1N5 w - - 0 1');
  assert.equal(knightVsKing.hasSufficientMaterial('w'), false, 'K+N alone cannot mate lone king');
  assert.equal(knightVsKing.hasSufficientMaterial('b'), false, 'Lone King cannot mate');

  // 4. King + Bishop vs King
  const bishopVsKing = new ChessGameEngine('8/8/8/8/8/k7/8/K1B5 w - - 0 1');
  assert.equal(bishopVsKing.hasSufficientMaterial('w'), false, 'K+B alone cannot mate lone king');

  // 5. King + 2 Bishops on opposite colors
  const twoBishops = new ChessGameEngine('8/8/8/8/8/k7/8/K1BB4 w - - 0 1');
  assert.equal(twoBishops.hasSufficientMaterial('w'), true, 'Two bishops on opposite colors can mate');

  // 6. King + Rook
  const rookVsKing = new ChessGameEngine('8/8/8/8/8/k7/8/K1R5 w - - 0 1');
  assert.equal(rookVsKing.hasSufficientMaterial('w'), true, 'Rook can mate');
});
