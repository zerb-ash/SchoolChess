import { Glicko1State, RatingCalculationResult } from '@schoolchess/shared-types';

export const GLICKO1_CONFIG = {
  Q: Math.LN10 / 400, // ~0.00575646273
  DEFAULT_INITIAL_RD: 350,
  MIN_RD: 30,
  MAX_RD: 350,
  PROVISIONAL_RD_THRESHOLD: 110,
} as const;

/**
 * Glicko-1 g(RD) scaling factor.
 */
export function glicko1G(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Math.pow(GLICKO1_CONFIG.Q, 2) * Math.pow(rd, 2)) / Math.pow(Math.PI, 2));
}

/**
 * Glicko-1 expected score.
 */
export function glicko1ExpectedScore(r: number, opponentR: number, opponentRd: number): number {
  const g = glicko1G(opponentRd);
  return 1 / (1 + Math.pow(10, (-g * (r - opponentR)) / 400));
}

/**
 * Pure, sub-microsecond calculation of Chess.com-style Glicko-1 rating update.
 * score: 1.0 (win), 0.5 (draw), 0.0 (loss)
 */
export function calculateGlicko1(
  player: Glicko1State,
  opponent: Glicko1State,
  score: number
): RatingCalculationResult {
  const q = GLICKO1_CONFIG.Q;
  const gOpp = glicko1G(opponent.rd);
  const expected = glicko1ExpectedScore(player.rating, opponent.rating, opponent.rd);

  // Variance d^2
  const dSquare = 1 / (Math.pow(q, 2) * Math.pow(gOpp, 2) * expected * (1 - expected));

  // Denominator: (1 / RD^2) + (1 / d^2)
  const denom = (1 / Math.pow(player.rd, 2)) + (1 / dSquare);

  // New rating and RD
  const delta = (q / denom) * gOpp * (score - expected);
  const newRating = Math.round(player.rating + delta);
  
  const rawNewRd = Math.sqrt(1 / denom);
  const newRd = Math.min(GLICKO1_CONFIG.MAX_RD, Math.max(GLICKO1_CONFIG.MIN_RD, Math.round(rawNewRd)));

  return {
    newRating,
    newRd,
    ratingDelta: newRating - player.rating,
    isProvisional: newRd > GLICKO1_CONFIG.PROVISIONAL_RD_THRESHOLD,
  };
}

