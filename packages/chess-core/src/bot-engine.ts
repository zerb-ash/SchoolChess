import { Chess, Move, Square } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
];

const KING_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20
];

export interface PositionEvaluation {
  score: number;
  centipawns: number;
  text: string;
  isCheckmate: boolean;
  mateIn?: number;
}

export function evaluateBoardPosition(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -30000 : 30000;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let whiteScore = 0;
  let blackScore = 0;

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const pieceVal = PIECE_VALUES[piece.type] || 0;
      let posVal = 0;

      const squareIdx = r * 8 + c;
      const flippedIdx = (7 - r) * 8 + c;

      switch (piece.type) {
        case 'p':
          posVal = piece.color === 'w' ? PAWN_TABLE[squareIdx] : PAWN_TABLE[flippedIdx];
          break;
        case 'n':
          posVal = piece.color === 'w' ? KNIGHT_TABLE[squareIdx] : KNIGHT_TABLE[flippedIdx];
          break;
        case 'b':
          posVal = piece.color === 'w' ? BISHOP_TABLE[squareIdx] : BISHOP_TABLE[flippedIdx];
          break;
        case 'r':
          posVal = piece.color === 'w' ? ROOK_TABLE[squareIdx] : ROOK_TABLE[flippedIdx];
          break;
        case 'k':
          posVal = piece.color === 'w' ? KING_TABLE[squareIdx] : KING_TABLE[flippedIdx];
          break;
        default:
          posVal = 0;
      }

      if (piece.color === 'w') {
        whiteScore += pieceVal + posVal;
      } else {
        blackScore += pieceVal + posVal;
      }
    }
  }

  return whiteScore - blackScore;
}

export function evaluatePosition(fen: string): PositionEvaluation {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    return {
      score: chess.turn() === 'w' ? -30000 : 30000,
      centipawns: chess.turn() === 'w' ? -1000 : 1000,
      text: winner === 'White' ? '+M1' : '-M1',
      isCheckmate: true,
      mateIn: 1,
    };
  }

  if (chess.isDraw()) {
    return { score: 0, centipawns: 0, text: '0.0', isCheckmate: false };
  }

  const score = evaluateBoardPosition(chess);
  const centipawns = Math.round(score);
  const cpVal = (centipawns / 100).toFixed(1);
  const text = centipawns >= 0 ? `+${cpVal}` : cpVal;

  return {
    score,
    centipawns,
    text,
    isCheckmate: false,
  };
}

// Negamax with alpha-beta pruning and move ordering
function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isWhite: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    const rawEval = evaluateBoardPosition(chess);
    return isWhite ? rawEval : -rawEval;
  }

  const moves = chess.moves({ verbose: true });
  moves.sort((a, b) => {
    const aCap = a.captured ? PIECE_VALUES[a.captured] || 100 : 0;
    const bCap = b.captured ? PIECE_VALUES[b.captured] || 100 : 0;
    return bCap - aCap;
  });

  let maxEval = -Infinity;
  for (const move of moves) {
    chess.move(move);
    const evaluation = -alphaBeta(chess, depth - 1, -beta, -alpha, !isWhite);
    chess.undo();

    maxEval = Math.max(maxEval, evaluation);
    alpha = Math.max(alpha, evaluation);
    if (beta <= alpha) break;
  }

  return maxEval;
}

export interface BotMoveResult {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  evalScore: number;
}

export function computeBotMove(fen: string, level: number = 3): BotMoveResult {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    throw new Error('No legal moves available');
  }

  const isWhite = chess.turn() === 'w';

  // Level 1 (~200 Elo): 50% random moves, 50% depth 1
  if (level <= 1) {
    if (Math.random() < 0.5) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return {
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion,
        san: randomMove.san,
        evalScore: 0,
      };
    }
  }

  // Level 2 (~600 Elo): Depth 1 with minor randomness
  // Level 3 (~1100 Elo): Depth 2
  // Level 4 (~1600 Elo): Depth 3
  // Level 5 (~2000 Elo): Depth 4
  const searchDepth = Math.min(4, Math.max(1, level - 1));

  let bestMove = moves[0];
  let bestScore = -Infinity;

  moves.sort((a, b) => {
    const aCap = a.captured ? PIECE_VALUES[a.captured] || 100 : 0;
    const bCap = b.captured ? PIECE_VALUES[b.captured] || 100 : 0;
    return bCap - aCap;
  });

  for (const move of moves) {
    chess.move(move);
    const score = -alphaBeta(chess, searchDepth - 1, -Infinity, Infinity, !isWhite);
    chess.undo();

    const jitter = level <= 2 ? (Math.random() - 0.5) * 40 : 0;
    const effectiveScore = score + jitter;

    if (effectiveScore > bestScore) {
      bestScore = effectiveScore;
      bestMove = move;
    }
  }

  return {
    from: bestMove.from,
    to: bestMove.to,
    promotion: bestMove.promotion,
    san: bestMove.san,
    evalScore: isWhite ? bestScore : -bestScore,
  };
}

