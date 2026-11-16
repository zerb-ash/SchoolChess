import { Glicko2State, RatingCalculationResult } from '@schoolchess/shared-types';

export const GLICKO2_CONFIG = {
  SCALE: 173.7178,
  TAU: 0.5, // System constant constraining volatility change over time
  EPSILON: 0.000001,
  DEFAULT_INITIAL_RATING: 1500,
  DEFAULT_INITIAL_RD: 350,
  DEFAULT_INITIAL_VOLATILITY: 0.06,
  PROVISIONAL_RD_THRESHOLD: 110,
} as const;

/**
 * Glicko-2 g(phi) function.
 */
export function glicko2G(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * Math.pow(phi, 2)) / Math.pow(Math.PI, 2));
}

/**
 * Glicko-2 expected score on the mu scale.
 */
export function glicko2ExpectedScore(mu: number, muOpp: number, phiOpp: number): number {
  const g = glicko2G(phiOpp);
  return 1 / (1 + Math.exp(-g * (mu - muOpp)));
}

/**
 * Pure, sub-microsecond calculation of Lichess-style Glicko-2 rating update.
 * score: 1.0 (win), 0.5 (draw), 0.0 (loss)
 */
export function calculateGlicko2(
  player: Glicko2State,
  opponent: Glicko2State,
  score: number
): RatingCalculationResult {
  const scale = GLICKO2_CONFIG.SCALE;
  const tau = GLICKO2_CONFIG.TAU;
  const eps = GLICKO2_CONFIG.EPSILON;

  // Step 1: Convert to Glicko-2 scale
  const mu = (player.rating - 1500) / scale;
  const phi = player.rd / scale;
  const sigma = player.volatility || GLICKO2_CONFIG.DEFAULT_INITIAL_VOLATILITY;

  const muOpp = (opponent.rating - 1500) / scale;
  const phiOpp = opponent.rd / scale;

  // Step 2: Compute variance v and estimated improvement Delta
  const gOpp = glicko2G(phiOpp);
  const expected = glicko2ExpectedScore(mu, muOpp, phiOpp);
  
  const v = 1 / (Math.pow(gOpp, 2) * expected * (1 - expected));
  const delta = v * gOpp * (score - expected);

  // Step 3: Determine new volatility sigma' using Illinois algorithm
  const a = Math.log(Math.pow(sigma, 2));
  const phiSq = Math.pow(phi, 2);
  const deltaSq = Math.pow(delta, 2);

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const denom = 2 * Math.pow(phiSq + v + ex, 2);
    const term1 = (ex * (deltaSq - phiSq - v - ex)) / denom;
    const term2 = (x - a) / Math.pow(tau, 2);
    return term1 - term2;
  };

  // Initial brackets
  let A = a;
  let B: number;
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k += 1;
      if (k > 100) break; // Safeguard against unbounded iteration
    }
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);

  // Illinois method root finding
  let iteration = 0;
  while (Math.abs(B - A) > eps && iteration < 100) {
    iteration += 1;
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2; // Illinois damping
    }
    B = C;
    fB = fC;
  }

  const newVolatility = Math.exp(A / 2);

  // Step 4: Update phi to phiStar
  const phiStar = Math.sqrt(phiSq + Math.pow(newVolatility, 2));

  // Step 5: Update phi and mu
  const newPhi = 1 / Math.sqrt((1 / Math.pow(phiStar, 2)) + (1 / v));
  const newMu = mu + Math.pow(newPhi, 2) * gOpp * (score - expected);

  // Step 6: Convert back to standard scale
  const newRating = Math.round(newMu * scale + 1500);
  const newRd = Math.round(newPhi * scale);

  return {
    newRating,
    newRd,
    newVolatility: Number(newVolatility.toFixed(6)),
    ratingDelta: newRating - player.rating,
    isProvisional: newRd > GLICKO2_CONFIG.PROVISIONAL_RD_THRESHOLD,
  };
}

