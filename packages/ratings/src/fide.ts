import { FideEloState, RatingCalculationResult } from '@schoolchess/shared-types';

export const FIDE_CONFIG = {
  MIN_RATING_FLOOR: 100,
  PROVISIONAL_GAMES_THRESHOLD: 30,
  K_FACTOR_PROVISIONAL_OR_JUNIOR: 40,
  K_FACTOR_STANDARD: 20,
  K_FACTOR_MASTER: 10,
  MAX_RATING_DIFFERENCE_CAP: 400, // FIDE 2024+ regulation for players < 2650
} as const;

/**
 * Determines development coefficient K based on FIDE regulations.
 */
export function getFideKFactor(state: FideEloState): number {
  if (state.gamesPlayed < FIDE_CONFIG.PROVISIONAL_GAMES_THRESHOLD || state.isUnder18) {
    return FIDE_CONFIG.K_FACTOR_PROVISIONAL_OR_JUNIOR;
  }
  if (state.rating < 2400) {
    return FIDE_CONFIG.K_FACTOR_STANDARD;
  }
  return FIDE_CONFIG.K_FACTOR_MASTER;
}

/**
 * Calculates FIDE expected score applying the 400-point difference rule.
 */
export function getFideExpectedScore(ratingA: number, ratingB: number): number {
  let diff = ratingB - ratingA;
  if (diff > FIDE_CONFIG.MAX_RATING_DIFFERENCE_CAP) {
    diff = FIDE_CONFIG.MAX_RATING_DIFFERENCE_CAP;
  } else if (diff < -FIDE_CONFIG.MAX_RATING_DIFFERENCE_CAP) {
    diff = -FIDE_CONFIG.MAX_RATING_DIFFERENCE_CAP;
  }
  return 1 / (1 + Math.pow(10, diff / 400));
}

/**
 * Pure, sub-microsecond calculation of FIDE Elo update.
 * score: 1.0 (win), 0.5 (draw), 0.0 (loss)
 */
export function calculateFideElo(
  player: FideEloState,
  opponent: FideEloState,
  score: number
): RatingCalculationResult {
  const k = getFideKFactor(player);
  const expected = getFideExpectedScore(player.rating, opponent.rating);
  const rawDelta = k * (score - expected);
  const roundedDelta = Math.round(rawDelta);
  
  const rawNewRating = player.rating + roundedDelta;
  const newRating = Math.max(FIDE_CONFIG.MIN_RATING_FLOOR, rawNewRating);
  const effectiveDelta = newRating - player.rating;

  return {
    newRating,
    ratingDelta: effectiveDelta,
    isProvisional: player.gamesPlayed + 1 < FIDE_CONFIG.PROVISIONAL_GAMES_THRESHOLD,
  };
}

