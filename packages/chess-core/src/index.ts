import { Chess } from 'chess.js';
import { GameTermination, PieceColor } from '@schoolchess/shared-types';

export interface ValidatedMoveResult {
  valid: boolean;
  errorCode?: 'ILLEGAL_MOVE' | 'INVALID_SQUARE' | 'WRONG_TURN';
  san?: string;
  uci?: string;
  from?: string;
  to?: string;
  fenAfter?: string;
  turn?: PieceColor;
  isCheck?: boolean;
  isGameOver?: boolean;
  result?: '1-0' | '0-1' | '1/2-1/2';
  termination?: GameTermination;
  winnerColor?: PieceColor;
}

export class ChessGameEngine {
  private instance: Chess;

  constructor(fen?: string) {
    this.instance = new Chess(fen);
  }

  public getFen(): string {
    return this.instance.fen();
  }

  public getPgn(): string {
    return this.instance.pgn();
  }

  public getTurn(): PieceColor {
    return this.instance.turn();
  }

  public getMoveHistory(): string[] {
    return this.instance.history();
  }

  public isCheck(): boolean {
    return this.instance.inCheck();
  }

  public isGameOver(): boolean {
    return this.instance.isGameOver();
  }

  public hasSufficientMaterial(color: PieceColor): boolean {
    return hasSufficientMaterialToMate(this.instance, color);
  }

  /**
   * Validates and applies a move in sub-millisecond execution time.
   */
  public applyMove(from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): ValidatedMoveResult {
    try {
      const move = this.instance.move({
        from,
        to,
        promotion: promotion || 'q',
      });

      if (!move) {
        return { valid: false, errorCode: 'ILLEGAL_MOVE' };
      }

      const isCheck = this.instance.inCheck();
      const isGameOver = this.instance.isGameOver();
      let result: '1-0' | '0-1' | '1/2-1/2' | undefined;
      let termination: GameTermination | undefined;
      let winnerColor: PieceColor | undefined;

      if (isGameOver) {
        if (this.instance.isCheckmate()) {
          // The player who just moved is the winner
          winnerColor = move.color;
          result = winnerColor === 'w' ? '1-0' : '0-1';
          termination = 'checkmate';
        } else if (this.instance.isStalemate()) {
          result = '1/2-1/2';
          termination = 'stalemate';
        } else if (this.instance.isInsufficientMaterial()) {
          result = '1/2-1/2';
          termination = 'insufficient_material';
        } else if (this.instance.isThreefoldRepetition()) {
          result = '1/2-1/2';
          termination = 'threefold_repetition';
        } else {
          result = '1/2-1/2';
          termination = 'fifty_moves';
        }
      }

      return {
        valid: true,
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion ? move.promotion : ''}`,
        from: move.from,
        to: move.to,
        fenAfter: this.instance.fen(),
        turn: this.instance.turn(),
        isCheck,
        isGameOver,
        result,
        termination,
        winnerColor,
      };
    } catch {
      return { valid: false, errorCode: 'ILLEGAL_MOVE' };
    }
  }

  /**
   * Resets board to standard starting position.
   */
  public reset(): void {
    this.instance.reset();
  }

  /**
   * Loads custom FEN string safely.
   */
  public loadFen(fen: string): boolean {
    try {
      this.instance.load(fen);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Determines whether a player has sufficient mating material under standard chess rules.
 * A player has insufficient material if checkmate is impossible against a lone king
 * (e.g. lone King, King + 1 Knight, King + 1 Bishop, King + Bishops on the same color,
 * or King + 2 Knights against a lone King).
 */
export function hasSufficientMaterialToMate(chess: Chess, color: PieceColor): boolean {
  const board = chess.board();
  let pawns = 0;
  let rooks = 0;
  let queens = 0;
  let knights = 0;
  let bishops = 0;
  const bishopColors: ('light' | 'dark')[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      if (piece.type === 'p') pawns++;
      else if (piece.type === 'r') rooks++;
      else if (piece.type === 'q') queens++;
      else if (piece.type === 'n') knights++;
      else if (piece.type === 'b') {
        bishops++;
        const isLight = (r + c) % 2 === 0;
        bishopColors.push(isLight ? 'light' : 'dark');
      }
    }
  }

  // Any pawn, rook, or queen can always deliver checkmate
  if (pawns > 0 || rooks > 0 || queens > 0) return true;

  // Lone king cannot checkmate
  if (knights === 0 && bishops === 0) return false;

  // King + single minor piece (1 knight or 1 bishop) cannot checkmate a lone king
  if (knights === 1 && bishops === 0) return false;
  if (bishops === 1 && knights === 0) return false;

  // King + multiple bishops all on the same square color cannot checkmate
  if (knights === 0 && bishops >= 2) {
    const allSameColor = bishopColors.every((c) => c === bishopColors[0]);
    if (allSameColor) return false;
  }

  // Check opponent's non-king pieces
  const oppColor = color === 'w' ? 'b' : 'w';
  let oppNonKingPieces = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === oppColor && piece.type !== 'k') {
        oppNonKingPieces++;
      }
    }
  }

  // Two knights vs lone king cannot force checkmate
  if (knights === 2 && bishops === 0 && oppNonKingPieces === 0) {
    return false;
  }

  return true;
}

export * from './bot-engine.js';
export * from './fair-play.js';


