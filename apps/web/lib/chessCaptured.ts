import { Chess } from 'chess.js';
import { PieceSymbol } from '../components/board/PieceSvg';

export const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

export interface CapturedPiecesResult {
  whiteCaptured: PieceSymbol[]; // pieces captured BY white (black pieces)
  blackCaptured: PieceSymbol[]; // pieces captured BY black (white pieces)
  whiteAdvantage: number;
  blackAdvantage: number;
}

export function computeCapturedPieces(fenOrChess: string | Chess): CapturedPiecesResult {
  let chess: Chess;
  try {
    chess = typeof fenOrChess === 'string' ? new Chess(fenOrChess) : fenOrChess;
  } catch {
    chess = new Chess();
  }

  const startPieces: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentCounts: { w: Record<string, number>; b: Record<string, number> } = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.type !== 'k') {
        currentCounts[sq.color][sq.type] = (currentCounts[sq.color][sq.type] || 0) + 1;
      }
    }
  }

  const whiteCaps: PieceSymbol[] = [];
  const blackCaps: PieceSymbol[] = [];
  let whiteTotalVal = 0;
  let blackTotalVal = 0;

  for (const [type, count] of Object.entries(startPieces)) {
    const missingBlack = Math.max(0, count - (currentCounts.b[type] || 0));
    for (let i = 0; i < missingBlack; i++) {
      whiteCaps.push(`b${type.toUpperCase()}` as PieceSymbol);
      whiteTotalVal += PIECE_VALUES[type] || 0;
    }

    const missingWhite = Math.max(0, count - (currentCounts.w[type] || 0));
    for (let i = 0; i < missingWhite; i++) {
      blackCaps.push(`w${type.toUpperCase()}` as PieceSymbol);
      blackTotalVal += PIECE_VALUES[type] || 0;
    }
  }

  return {
    whiteCaptured: whiteCaps,
    blackCaptured: blackCaps,
    whiteAdvantage: Math.max(0, whiteTotalVal - blackTotalVal),
    blackAdvantage: Math.max(0, blackTotalVal - whiteTotalVal),
  };
}

