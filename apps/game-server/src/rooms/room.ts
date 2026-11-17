import { WebSocket } from 'ws';
import { ChessGameEngine, ValidatedMoveResult } from '@schoolchess/chess-core';
import { AuthoritativeClock } from '../clock/authoritative-clock.js';
import { MoveSubmission, DrawAction, PieceColor, GameTermination } from '@schoolchess/shared-types';

export interface PlayerInfo {
  id: string;
  username: string;
  rating: number;
}

export interface GameRoomOptions {
  gameId: string;
  white: PlayerInfo;
  black: PlayerInfo;
  baseTimeSeconds: number;
  incrementSeconds: number;
  rated: boolean;
  onGameOver?: (result: '1-0' | '0-1' | '1/2-1/2', termination: GameTermination, winnerId?: string) => void;
}

export class GameRoom {
  public readonly gameId: string;
  public readonly white: PlayerInfo;
  public readonly black: PlayerInfo;
  public readonly rated: boolean;
  private engine: ChessGameEngine;
  private clock: AuthoritativeClock;
  private moveNumber = 0;
  private idempotencyCache = new Set<string>();
  private sockets = new Set<WebSocket>();
  private status: 'pending' | 'active' | 'completed' | 'aborted' = 'active';
  private drawOfferFrom: 'w' | 'b' | null = null;
  private onGameOverCallback?: (result: '1-0' | '0-1' | '1/2-1/2', termination: GameTermination, winnerId?: string) => void;
  private whiteConnected = false;
  private blackConnected = false;

  constructor(options: GameRoomOptions) {
    this.gameId = options.gameId;
    this.white = options.white;
    this.black = options.black;
    this.rated = options.rated;
    this.onGameOverCallback = options.onGameOver;

    this.engine = new ChessGameEngine();
    this.clock = new AuthoritativeClock(
      options.baseTimeSeconds * 1000,
      options.incrementSeconds * 1000,
      (loserColor) => this.handleTimeout(loserColor)
    );
    this.clock.start();
  }

  public addSocket(ws: WebSocket, userId: string): void {
    this.sockets.add(ws);
    if (userId === this.white.id) this.whiteConnected = true;
    if (userId === this.black.id) this.blackConnected = true;

    this.sendTo(ws, {
      type: 'game:state',
      payload: this.getStatePayload(),
    });

    this.broadcast({
      type: 'game:presence',
      payload: {
        whiteConnected: this.whiteConnected,
        blackConnected: this.blackConnected,
      },
    });
  }

  public removeSocket(ws: WebSocket, userId: string): void {
    this.sockets.delete(ws);
    if (userId === this.white.id) this.whiteConnected = false;
    if (userId === this.black.id) this.blackConnected = false;

    this.broadcast({
      type: 'game:presence',
      payload: {
        whiteConnected: this.whiteConnected,
        blackConnected: this.blackConnected,
      },
    });
  }

  public applyMove(userId: string, submission: MoveSubmission, clientWs: WebSocket): void {
    if (this.status !== 'active') {
      this.sendTo(clientWs, {
        type: 'game:move_rejected',
        payload: { expectedMoveNumber: this.moveNumber, errorCode: 'GAME_NOT_ACTIVE', currentFen: this.engine.getFen() },
      });
      return;
    }

    const expectedColor: PieceColor = this.engine.getTurn();
    const activeUserId = expectedColor === 'w' ? this.white.id : this.black.id;

    if (userId !== activeUserId) {
      this.sendTo(clientWs, {
        type: 'game:move_rejected',
        payload: { expectedMoveNumber: this.moveNumber, errorCode: 'WRONG_TURN', currentFen: this.engine.getFen() },
      });
      return;
    }

    if (submission.expectedMoveNumber !== this.moveNumber) {
      this.sendTo(clientWs, {
        type: 'game:move_rejected',
        payload: { expectedMoveNumber: this.moveNumber, errorCode: 'STALE_SEQUENCE', currentFen: this.engine.getFen() },
      });
      return;
    }

    if (this.idempotencyCache.has(submission.idempotencyKey)) {
      return;
    }
    this.idempotencyCache.add(submission.idempotencyKey);

    const moveResult: ValidatedMoveResult = this.engine.applyMove(
      submission.from,
      submission.to,
      submission.promotion
    );

    if (!moveResult.valid) {
      this.sendTo(clientWs, {
        type: 'game:move_rejected',
        payload: { expectedMoveNumber: this.moveNumber, errorCode: 'ILLEGAL_MOVE', currentFen: this.engine.getFen() },
      });
      return;
    }

    this.moveNumber += 1;
    this.drawOfferFrom = null;

    const clockSnapshot = this.clock.recordMove(expectedColor);

    this.broadcast({
      type: 'game:move_applied',
      payload: {
        gameId: this.gameId,
        move: {
          from: submission.from,
          to: submission.to,
          san: moveResult.san!,
          uci: moveResult.uci!,
          promotion: submission.promotion,
        },
        fen: moveResult.fenAfter!,
        turn: moveResult.turn!,
        moveNumber: this.moveNumber,
        whiteClockMs: clockSnapshot.whiteMs,
        blackClockMs: clockSnapshot.blackMs,
        isCheck: !!moveResult.isCheck,
        serverTimestamp: Date.now(),
      },
    });

    if (moveResult.isGameOver) {
      this.finishGame(
        moveResult.result!,
        moveResult.termination!,
        moveResult.winnerColor === 'w' ? this.white.id : moveResult.winnerColor === 'b' ? this.black.id : undefined
      );
    }
  }

  public handleResign(userId: string): void {
    if (this.status !== 'active') return;
    if (userId !== this.white.id && userId !== this.black.id) return;

    const winnerId = userId === this.white.id ? this.black.id : this.white.id;
    const result = userId === this.white.id ? '0-1' : '1-0';
    this.finishGame(result, 'resignation', winnerId);
  }

  public handleDrawAction(userId: string, action: DrawAction['action']): void {
    if (this.status !== 'active') return;
    const color = userId === this.white.id ? 'w' : userId === this.black.id ? 'b' : null;
    if (!color) return;

    if (action === 'offer') {
      this.drawOfferFrom = color;
      this.broadcast({
        type: 'game:draw_offered',
        payload: { fromColor: color },
      });
    } else if (action === 'accept' && this.drawOfferFrom && this.drawOfferFrom !== color) {
      this.finishGame('1/2-1/2', 'draw_agreement');
    } else if (action === 'decline' && this.drawOfferFrom && this.drawOfferFrom !== color) {
      this.drawOfferFrom = null;
      this.broadcast({
        type: 'game:draw_declined',
        payload: { byColor: color },
      });
    }
  }

  private handleTimeout(loserColor: 'w' | 'b'): void {
    if (this.status !== 'active') return;
    const result = loserColor === 'w' ? '0-1' : '1-0';
    const winnerId = loserColor === 'w' ? this.black.id : this.white.id;
    this.finishGame(result, 'timeout', winnerId);
  }

  private finishGame(result: '1-0' | '0-1' | '1/2-1/2', termination: GameTermination, winnerId?: string): void {
    this.status = 'completed';
    this.clock.stop();

    this.broadcast({
      type: 'game:over',
      payload: {
        gameId: this.gameId,
        result,
        termination,
        winnerId,
      },
    });

    this.onGameOverCallback?.(result, termination, winnerId);
  }

  public getStatePayload() {
    const clockSnap = this.clock.getSnapshot();
    return {
      gameId: this.gameId,
      white: this.white,
      black: this.black,
      fen: this.engine.getFen(),
      turn: this.engine.getTurn(),
      moveNumber: this.moveNumber,
      whiteClockMs: clockSnap.whiteMs,
      blackClockMs: clockSnap.blackMs,
      status: this.status,
      serverTimestamp: Date.now(),
    };
  }

  private broadcast(msg: unknown): void {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private sendTo(ws: WebSocket, msg: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  public destroy(): void {
    this.clock.stop();
    this.sockets.clear();
  }
}

