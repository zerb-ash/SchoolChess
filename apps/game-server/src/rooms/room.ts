import { WebSocket } from 'ws';
import { ChessGameEngine, ValidatedMoveResult } from '@schoolchess/chess-core';
import { AuthoritativeClock } from '../clock/authoritative-clock.js';
import { MoveSubmission, DrawAction, PieceColor, GameTermination, GameResult } from '@schoolchess/shared-types';

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
  timeControl?: string;
  onGameOver?: (result: GameResult, termination: GameTermination, winnerId?: string) => void;
}

export class GameRoom {
  public readonly gameId: string;
  public white: PlayerInfo;
  public black: PlayerInfo;
  public readonly rated: boolean;
  public readonly timeControl: string;
  private engine: ChessGameEngine;
  private clock: AuthoritativeClock;
  private moveNumber = 0;
  private idempotencyCache = new Set<string>();
  private sockets = new Set<WebSocket>();
  private status: 'pending' | 'active' | 'completed' | 'aborted' = 'active';
  private drawOfferFrom: 'w' | 'b' | null = null;
  private onGameOverCallback?: (result: GameResult, termination: GameTermination, winnerId?: string) => void;
  private whiteConnected = false;
  private blackConnected = false;
  private whiteEverConnected = false;
  private blackEverConnected = false;
  private clockStarted = false;
  private emptyRoomTimeout: NodeJS.Timeout | null = null;
  private playerDisconnectTimeout: NodeJS.Timeout | null = null;

  constructor(options: GameRoomOptions) {
    this.gameId = options.gameId;
    this.white = options.white;
    this.black = options.black;
    this.rated = options.rated;
    this.timeControl = options.timeControl || `${Math.floor(options.baseTimeSeconds / 60)}+${options.incrementSeconds}`;
    this.onGameOverCallback = options.onGameOver;

    this.engine = new ChessGameEngine();
    this.clock = new AuthoritativeClock(
      options.baseTimeSeconds * 1000,
      options.incrementSeconds * 1000,
      (loserColor) => this.handleTimeout(loserColor)
    );
    if (this.isBothSeated()) {
      this.clockStarted = true;
      this.clock.start();
    }
  }

  public isWhiteConnected(): boolean {
    return this.whiteConnected;
  }

  public isBlackConnected(): boolean {
    return this.blackConnected;
  }

  public bothEverConnected(): boolean {
    return this.whiteEverConnected && this.blackEverConnected;
  }

  public getStatus(): string {
    return this.status;
  }

  public abortAbandonedRoom(): void {
    if (this.status === 'active') {
      this.finishGame('1/2-1/2', 'abandoned');
    }
  }

  public isBothSeated(): boolean {
    return (
      !!this.white.id &&
      this.white.id !== 'Waiting...' &&
      this.white.id !== '' &&
      !!this.black.id &&
      this.black.id !== 'Waiting...' &&
      this.black.id !== '' &&
      this.black.id !== 'opponent_placeholder'
    );
  }

  private checkStartClock(): void {
    if (this.isBothSeated() && !this.clockStarted) {
      this.clockStarted = true;
      this.clock.start();
    }
  }

  public setWhitePlayer(player: PlayerInfo): void {
    this.white = player;
    this.checkStartClock();
    this.broadcast({
      type: 'game:state',
      payload: this.getStatePayload(),
    });
  }

  public setBlackPlayer(player: PlayerInfo): void {
    this.black = player;
    this.checkStartClock();
    this.broadcast({
      type: 'game:state',
      payload: this.getStatePayload(),
    });
  }

  public addSocket(ws: WebSocket, userId: string, username?: string): void {
    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = null;
    }

    this.sockets.add(ws);
    const isWhiteMatch = userId === this.white.id || (username && this.white.username && username.toLowerCase() === this.white.username.toLowerCase());
    const isBlackMatch = userId === this.black.id || (username && this.black.username && username.toLowerCase() === this.black.username.toLowerCase());

    if (isWhiteMatch) {
      this.whiteConnected = true;
      this.whiteEverConnected = true;
    }
    if (isBlackMatch) {
      this.blackConnected = true;
      this.blackEverConnected = true;
    }

    if (this.whiteConnected && this.blackConnected && this.playerDisconnectTimeout) {
      clearTimeout(this.playerDisconnectTimeout);
      this.playerDisconnectTimeout = null;
    }

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

  public removeSocket(ws: WebSocket, userId: string, username?: string): void {
    this.sockets.delete(ws);
    const isWhiteMatch = userId === this.white.id || (username && this.white.username && username.toLowerCase() === this.white.username.toLowerCase());
    const isBlackMatch = userId === this.black.id || (username && this.black.username && username.toLowerCase() === this.black.username.toLowerCase());

    if (isWhiteMatch) this.whiteConnected = false;
    if (isBlackMatch) this.blackConnected = false;

    this.broadcast({
      type: 'game:presence',
      payload: {
        whiteConnected: this.whiteConnected,
        blackConnected: this.blackConnected,
      },
    });

    // Case 1: Room was waiting for an opponent and the creator/challenger leaves
    if (!this.isBothSeated() && this.status === 'active') {
      const hasWhite = !!this.white.id && this.white.id !== 'Waiting...';
      const hasBlack = !!this.black.id && this.black.id !== 'Waiting...' && this.black.id !== 'opponent_placeholder';
      const creatorConnected = (hasWhite && this.whiteConnected) || (hasBlack && this.blackConnected);

      if (!creatorConnected) {
        if (this.emptyRoomTimeout) clearTimeout(this.emptyRoomTimeout);
        this.emptyRoomTimeout = setTimeout(() => {
          const stillConnected = (hasWhite && this.whiteConnected) || (hasBlack && this.blackConnected);
          if (!stillConnected && !this.isBothSeated() && this.status === 'active') {
            this.finishGame('*', 'aborted');
          }
        }, 5000);
      }
    }

    // Case 2: Game is active with 0 moves made and either player disconnects
    if (this.isBothSeated() && this.moveNumber === 0 && this.status === 'active') {
      if (!this.whiteConnected || !this.blackConnected) {
        if (this.emptyRoomTimeout) clearTimeout(this.emptyRoomTimeout);
        this.emptyRoomTimeout = setTimeout(() => {
          if ((!this.whiteConnected || !this.blackConnected) && this.moveNumber === 0 && this.status === 'active') {
            this.finishGame('*', 'aborted');
          }
        }, 15000);
      }
    }

    // Case 3: Both players are disconnected from the game tab
    if (!this.whiteConnected && !this.blackConnected && this.status === 'active') {
      if (this.emptyRoomTimeout) clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = setTimeout(() => {
        if (!this.whiteConnected && !this.blackConnected && this.status === 'active') {
          this.finishGame('1/2-1/2', 'abandoned');
        }
      }, 15000);
    }

    // Case 4: Moves have been played (>0) and ONE player disconnects: 60s reconnection window
    if (this.isBothSeated() && this.moveNumber > 0 && this.status === 'active') {
      if (!this.whiteConnected && this.blackConnected) {
        if (this.playerDisconnectTimeout) clearTimeout(this.playerDisconnectTimeout);
        this.playerDisconnectTimeout = setTimeout(() => {
          if (!this.whiteConnected && this.blackConnected && this.status === 'active') {
            this.finishGame('0-1', 'abandoned', this.black.id);
          }
        }, 60000);
      } else if (!this.blackConnected && this.whiteConnected) {
        if (this.playerDisconnectTimeout) clearTimeout(this.playerDisconnectTimeout);
        this.playerDisconnectTimeout = setTimeout(() => {
          if (!this.blackConnected && this.whiteConnected && this.status === 'active') {
            this.finishGame('1-0', 'abandoned', this.white.id);
          }
        }, 60000);
      }
    }
  }

  public applyMove(userId: string, submission: MoveSubmission, clientWs: WebSocket, username?: string): void {
    if (this.status !== 'active') {
      this.sendTo(clientWs, {
        type: 'game:move_rejected',
        payload: { expectedMoveNumber: this.moveNumber, errorCode: 'GAME_NOT_ACTIVE', currentFen: this.engine.getFen() },
      });
      return;
    }

    const expectedColor: PieceColor = this.engine.getTurn();
    const activePlayer = expectedColor === 'w' ? this.white : this.black;
    const isPlayerMatch =
      userId === activePlayer.id ||
      (username && activePlayer.username && username.toLowerCase() === activePlayer.username.toLowerCase());

    if (!isPlayerMatch) {
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

    if (!this.clockStarted) {
      this.clockStarted = true;
      this.clock.start();
    }

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
    const isWhite = userId === this.white.id || (!!this.white.username && userId === this.white.username);
    const isBlack = userId === this.black.id || (!!this.black.username && userId === this.black.username);
    if (!isWhite && !isBlack) return;

    const winnerId = isWhite ? this.black.id : this.white.id;
    const result = isWhite ? '0-1' : '1-0';
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

  public finishGame(result: GameResult, termination: GameTermination, winnerId?: string): void {
    if (this.status === 'completed' || this.status === 'aborted') return;
    this.status = termination === 'aborted' || (termination === 'abandoned' && this.moveNumber === 0) ? 'aborted' : 'completed';
    this.clock.stop();

    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = null;
    }
    if (this.playerDisconnectTimeout) {
      clearTimeout(this.playerDisconnectTimeout);
      this.playerDisconnectTimeout = null;
    }

    this.broadcast({
      type: 'game:over',
      payload: {
        gameId: this.gameId,
        result,
        termination,
        winnerId,
        rated: this.rated,
      },
    });

    this.onGameOverCallback?.(result, termination, winnerId);

    // Call API server to finalize ratings & persist game history
    const apiBase = process.env.API_URL || 'http://localhost:4000';
    fetch(`${apiBase}/api/v1/games/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: this.gameId,
        timeControl: this.timeControl,
        whiteUserId: this.white.id,
        whiteUsername: this.white.username,
        blackUserId: this.black.id,
        blackUsername: this.black.username,
        result,
        termination,
        movesCount: this.moveNumber,
        finalFen: this.engine.getFen(),
        rated: this.rated,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as any;
          this.broadcast({
            type: 'game:over',
            payload: {
              gameId: this.gameId,
              result,
              termination,
              winnerId,
              rated: data.rated,
              ratingUpdates: {
                white: data.whiteRatingUpdates,
                black: data.blackRatingUpdates,
              },
            },
          });
        }
      })
      .catch(() => {});
  }

  public getStatePayload() {
    const clockSnap = this.clock.getSnapshot();
    return {
      gameId: this.gameId,
      white: this.white,
      black: this.black,
      timeControl: this.timeControl,
      rated: this.rated,
      fen: this.engine.getFen(),
      turn: this.engine.getTurn(),
      moveNumber: this.moveNumber,
      whiteClockMs: clockSnap.whiteMs,
      blackClockMs: clockSnap.blackMs,
      status: this.status,
      history: this.engine.getMoveHistory(),
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

  public forceTerminate(reason: string = 'Game terminated by administrator.'): void {
    this.finishGame('1/2-1/2', 'aborted');
    this.broadcast({
      type: 'game:over',
      payload: {
        gameId: this.gameId,
        result: '1/2-1/2',
        termination: 'aborted',
        message: reason,
        completed: true,
      },
    });
    this.status = 'aborted';
    this.destroy();
  }

  public destroy(): void {
    if (this.emptyRoomTimeout) {
      clearTimeout(this.emptyRoomTimeout);
      this.emptyRoomTimeout = null;
    }
    if (this.playerDisconnectTimeout) {
      clearTimeout(this.playerDisconnectTimeout);
      this.playerDisconnectTimeout = null;
    }
    this.clock.stop();
    this.sockets.clear();
  }
}

