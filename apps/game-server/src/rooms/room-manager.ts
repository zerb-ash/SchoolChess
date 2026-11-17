import { GameRoom, GameRoomOptions } from './room.js';

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  public getOrCreateRoom(options: GameRoomOptions): GameRoom {
    const existing = this.rooms.get(options.gameId);
    if (existing) return existing;

    const newRoom = new GameRoom(options);
    this.rooms.set(options.gameId, newRoom);
    return newRoom;
  }

  public getRoom(gameId: string): GameRoom | null {
    return this.rooms.get(gameId) ?? null;
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
}

export const roomManager = new RoomManager();

