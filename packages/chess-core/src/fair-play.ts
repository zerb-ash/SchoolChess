import { evaluatePosition } from './bot-engine.js';
import { Chess } from 'chess.js';

export type MoveClassification = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveAnalysis {
  san: string;
  from: string;
  to: string;
  turn: 'w' | 'b';
  evalBefore: number;
  evalAfter: number;
  centipawnLoss: number;
  classification: MoveClassification;
}

export interface GameFairPlayReport {
  whiteAcpl: number;
  blackAcpl: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteMoveCount: number;
  blackMoveCount: number;
  flaggedAnomaly: boolean;
  anomalyReason?: string;
  moveAnalyses: MoveAnalysis[];
}

export function classifyCentipawnLoss(loss: number): MoveClassification {
  if (loss <= 10) return 'best';
  if (loss <= 30) return 'excellent';
  if (loss <= 75) return 'good';
  if (loss <= 150) return 'inaccuracy';
  if (loss <= 300) return 'mistake';
  return 'blunder';
}

export function computeAverageCentipawnLoss(losses: number[]): number {
  if (losses.length === 0) return 0;
  const sum = losses.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / losses.length) * 10) / 10;
}

export function calculateAccuracyPercentage(acpl: number): number {
  // Sigmoid-based accuracy calculation modeled after standard chess engines
  const acc = 103.1668 * Math.exp(-0.04354 * (acpl / 10)) - 3.1669;
  return Math.min(100, Math.max(0, Math.round(acc * 10) / 10));
}

export function analyzeMoveTimeDistribution(moveTimesMs: number[]): {
  averageMs: number;
  stdDevMs: number;
  isUnnaturalCadence: boolean;
} {
  if (moveTimesMs.length < 10) {
    return { averageMs: 0, stdDevMs: 0, isUnnaturalCadence: false };
  }

  const avg = moveTimesMs.reduce((a, b) => a + b, 0) / moveTimesMs.length;
  const variance = moveTimesMs.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / moveTimesMs.length;
  const stdDev = Math.sqrt(variance);

  // Unnatural cadence: robotic consistency where thought time variance is extremely low across 15+ moves
  const isUnnatural = moveTimesMs.length >= 15 && stdDev < 250 && avg > 1500;

  return {
    averageMs: Math.round(avg),
    stdDevMs: Math.round(stdDev),
    isUnnaturalCadence: isUnnatural,
  };
}

export function analyzeGameMoves(
  moves: Array<{ from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }>,
  initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
): GameFairPlayReport {
  const chess = new Chess(initialFen);
  const whiteLosses: number[] = [];
  const blackLosses: number[] = [];
  const analyses: MoveAnalysis[] = [];

  for (const m of moves) {
    const turn = chess.turn();
    const fenBefore = chess.fen();
    const evalBefore = evaluatePosition(fenBefore).centipawns;

    const res = chess.move({
      from: m.from,
      to: m.to,
      promotion: m.promotion || 'q',
    });

    if (!res) continue;

    const fenAfter = chess.fen();
    const evalAfter = evaluatePosition(fenAfter).centipawns;

    // Centipawn loss is computed relative to the player whose turn it was
    const delta = turn === 'w' ? evalBefore - evalAfter : evalAfter - evalBefore;
    const loss = Math.max(0, delta);

    if (turn === 'w') {
      whiteLosses.push(loss);
    } else {
      blackLosses.push(loss);
    }

    analyses.push({
      san: res.san,
      from: m.from,
      to: m.to,
      turn,
      evalBefore,
      evalAfter,
      centipawnLoss: loss,
      classification: classifyCentipawnLoss(loss),
    });
  }

  const whiteAcpl = computeAverageCentipawnLoss(whiteLosses);
  const blackAcpl = computeAverageCentipawnLoss(blackLosses);

  const whiteAccuracy = calculateAccuracyPercentage(whiteAcpl);
  const blackAccuracy = calculateAccuracyPercentage(blackAcpl);

  // Flag anomalous play: Low ACPL under 15 with over 25 non-trivial moves
  let flaggedAnomaly = false;
  let anomalyReason: string | undefined;

  if (whiteLosses.length >= 25 && whiteAcpl < 15) {
    flaggedAnomaly = true;
    anomalyReason = 'White achieved near-flawless engine precision (< 15 ACPL over 25+ moves)';
  } else if (blackLosses.length >= 25 && blackAcpl < 15) {
    flaggedAnomaly = true;
    anomalyReason = 'Black achieved near-flawless engine precision (< 15 ACPL over 25+ moves)';
  }

  return {
    whiteAcpl,
    blackAcpl,
    whiteAccuracy,
    blackAccuracy,
    whiteMoveCount: whiteLosses.length,
    blackMoveCount: blackLosses.length,
    flaggedAnomaly,
    anomalyReason,
    moveAnalyses: analyses,
  };
}

