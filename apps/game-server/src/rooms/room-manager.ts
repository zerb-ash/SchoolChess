import { GameRoom, GameRoomOptions } from './room.js';

export interface CompletedGameInfo {
  gameId: string;
  result: string;
  termination: string;
  completedAt: number;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private completedGames = new Map<string, CompletedGameInfo>();

  public markCompleted(gameId: string, result: string, termination: string): void {
    this.completedGames.set(gameId, {
      gameId,
      result,
      termination,
      completedAt: Date.now(),
    });

    // Prune entries older than 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, info] of this.completedGames.entries()) {
      if (info.completedAt < cutoff) {
        this.completedGames.delete(id);
      }
    }
  }

  public isCompleted(gameId: string): boolean {
    return this.completedGames.has(gameId);
  }

  public getCompletedInfo(gameId: string): CompletedGameInfo | undefined {
    return this.completedGames.get(gameId);
  }

  public getOrCreateRoom(options: GameRoomOptions): GameRoom | null {
    if (this.isCompleted(options.gameId)) {
      return null;
    }

    const existing = this.rooms.get(options.gameId);
    if (existing) return existing;

    const newRoom = new GameRoom({
      ...options,
      onGameOver: (result, termination, winnerId) => {
        options.onGameOver?.(result, termination, winnerId);
        this.markCompleted(options.gameId, result, termination);
        // Automatically cleanup finished game from active rooms after a 10 second window
        setTimeout(() => {
          this.removeRoom(options.gameId);
        }, 10000);
      },
    });
    this.rooms.set(options.gameId, newRoom);
    return newRoom;
  }

  public getRoom(gameId: string): GameRoom | null {
    return this.rooms.get(gameId) ?? null;
  }

  public getAllRawRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  public removeRoom(gameId: string): void {
    const room = this.rooms.get(gameId);
    if (room) {
      room.destroy();
      this.rooms.delete(gameId);
    }
  }

  public getActiveCount(): number {
    return this.rooms.size;
  }

  public getAllRooms(): Array<ReturnType<GameRoom['getStatePayload']>> {
    const list: Array<ReturnType<GameRoom['getStatePayload']>> = [];
    for (const room of this.rooms.values()) {
      if (room.getStatus() === 'active' || room.getStatus() === 'pending') {
        list.push(room.getStatePayload());
      }
    }
    return list;
  }
}

export const roomManager = new RoomManager();
