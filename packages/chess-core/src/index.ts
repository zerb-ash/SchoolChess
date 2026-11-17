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

export * from './bot-engine.js';


