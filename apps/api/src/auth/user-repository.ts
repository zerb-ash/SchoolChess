import fs from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { DatabaseInstance, users, userRatings, userStatistics, userSettings } from '@schoolchess/database';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  bio?: string;
  avatarUrl?: string;
  views?: number;
  lastSeenAt?: Date;
}

export interface UserRatingSummary {
  system: string;
  category: string;
  rating: number;
  provisional: boolean;
  rd?: number;
  volatility?: number;
  gamesCount?: number;
}

export interface CompletedGameRecord {
  id: string;
  timeControl: string;
  category: string;
  whiteUserId: string;
  whiteUsername: string;
  whiteRating: number;
  whiteAvatarUrl?: string;
  blackUserId: string;
  blackUsername: string;
  blackRating: number;
  blackAvatarUrl?: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: string;
  movesCount: number;
  accuracyWhite?: number;
  accuracyBlack?: number;
  finalFen?: string;
  playedAt: Date;
}

export interface IUserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  createUser(username: string, passwordHash: string): Promise<UserRecord>;
  getUserRatings(userId: string): Promise<UserRatingSummary[]>;
  updateUserRating?(
    userId: string,
    system: string,
    category: string,
    newRating: number,
    newRd?: number,
    newVolatility?: number
  ): Promise<void>;
  getAllUsers?(): Promise<UserRecord[]>;
  updateProfile?(userId: string, data: { bio?: string; avatarUrl?: string }): Promise<UserRecord | null>;
  incrementViews?(userId: string): Promise<number>;
  recordGame?(game: CompletedGameRecord): Promise<void>;
  getUserGames?(userId: string): Promise<CompletedGameRecord[]>;
  updateLastSeen?(userId: string, date: Date): Promise<void>;
}

export class PostgresUserRepository implements IUserRepository {
  constructor(private db: DatabaseInstance) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    const res = await this.db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1);

    return res[0] ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const res = await this.db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return res[0] ?? null;
  }

  async createUser(username: string, passwordHash: string): Promise<UserRecord> {
    const categories = ['bullet', 'blitz', 'rapid', 'classical'] as const;
    const systems = ['fide', 'chess_com', 'lichess'] as const;

    const insertedUser = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ username, passwordHash })
        .returning({
          id: users.id,
          username: users.username,
          passwordHash: users.passwordHash,
          createdAt: users.createdAt,
        });

      for (const sys of systems) {
        for (const cat of categories) {
          await tx.insert(userRatings).values({
            userId: u.id,
            system: sys,
            category: cat,
            rating: 200,
            ratingDeviation: sys === 'fide' ? null : 350,
            volatility: sys === 'lichess' ? 0.06 : null,
            kFactor: sys === 'fide' ? 40 : null,
            peakRating: 200,
            provisional: true,
          });
        }
      }

      await tx.insert(userStatistics).values({ userId: u.id });
      await tx.insert(userSettings).values({ userId: u.id });

      return u;
    });

    return insertedUser;
  }

  async getUserRatings(userId: string): Promise<UserRatingSummary[]> {
    return this.db
      .select({
        system: userRatings.system,
        category: userRatings.category,
        rating: userRatings.rating,
        provisional: userRatings.provisional,
      })
      .from(userRatings)
      .where(eq(userRatings.userId, userId));
  }
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, UserRecord>();
  private ratings = new Map<string, UserRatingSummary[]>();
  private games: CompletedGameRecord[] = [];
  private dataFilePath: string;

  constructor(filePath?: string) {
    this.dataFilePath =
      filePath ||
      process.env.DATA_FILE_PATH ||
      path.resolve(process.cwd(), 'data', 'schoolchess_db.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.users && Array.isArray(data.users)) {
          for (const u of data.users) {
            this.users.set(u.id, {
              ...u,
              createdAt: new Date(u.createdAt),
              lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt) : new Date(u.createdAt),
            });
          }
        }
        if (data.ratings && typeof data.ratings === 'object') {
          for (const [userId, list] of Object.entries(data.ratings)) {
            this.ratings.set(userId, list as UserRatingSummary[]);
          }
        }
        if (data.games && Array.isArray(data.games)) {
          this.games = data.games.map((g: any) => ({
            ...g,
            playedAt: g.playedAt ? new Date(g.playedAt) : new Date(),
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to load in-memory storage from disk:', e);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        users: Array.from(this.users.values()),
        ratings: Object.fromEntries(this.ratings.entries()),
        games: this.games,
      };
      fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to save in-memory storage to disk:', e);
    }
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const target = username.toLowerCase();
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === target) {
        return u;
      }
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(username: string, passwordHash: string): Promise<UserRecord> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `usr_${Math.random().toString(36).substring(2, 10)}`;

    const record: UserRecord = {
      id,
      username,
      passwordHash,
      createdAt: new Date(),
      bio: 'No bio',
      avatarUrl: '',
      views: 0,
      lastSeenAt: new Date(),
    };

    this.users.set(id, record);

    const categories = ['bullet', 'blitz', 'rapid', 'classical'] as const;
    const systems = ['fide', 'chess_com', 'lichess'] as const;
    const userRatingList: UserRatingSummary[] = [];

    for (const sys of systems) {
      for (const cat of categories) {
        userRatingList.push({
          system: sys,
          category: cat,
          rating: 200,
          provisional: true,
          rd: sys === 'fide' ? undefined : 350,
          volatility: sys === 'lichess' ? 0.06 : undefined,
          gamesCount: 0,
        });
      }
    }

    this.ratings.set(id, userRatingList);
    this.saveToDisk();
    return record;
  }

  async getUserRatings(userId: string): Promise<UserRatingSummary[]> {
    return this.ratings.get(userId) ?? [];
  }

  async updateUserRating(
    userId: string,
    system: string,
    category: string,
    newRating: number,
    newRd?: number,
    newVolatility?: number
  ): Promise<void> {
    const list = this.ratings.get(userId);
    if (!list) return;
    const entry = list.find((r) => r.system === system && r.category === category);
    if (entry) {
      entry.rating = Math.max(100, Math.round(newRating));
      if (newRd !== undefined) entry.rd = newRd;
      if (newVolatility !== undefined) entry.volatility = newVolatility;
      entry.gamesCount = (entry.gamesCount || 0) + 1;
      entry.provisional = (entry.gamesCount || 0) < 10;
    } else {
      list.push({
        system,
        category,
        rating: Math.max(100, Math.round(newRating)),
        provisional: false,
        rd: newRd,
        volatility: newVolatility,
        gamesCount: 1,
      });
    }
    this.saveToDisk();
  }

  async getAllUsers(): Promise<UserRecord[]> {
    return Array.from(this.users.values());
  }

  async updateProfile(userId: string, data: { bio?: string; avatarUrl?: string }): Promise<UserRecord | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    user.lastSeenAt = new Date();
    this.saveToDisk();
    return user;
  }

  async incrementViews(userId: string): Promise<number> {
    const user = this.users.get(userId);
    if (!user) return 0;
    user.views = (user.views || 0) + 1;
    this.saveToDisk();
    return user.views;
  }

  async recordGame(game: CompletedGameRecord): Promise<void> {
    const idx = this.games.findIndex((g) => g.id === game.id);
    if (idx >= 0) {
      this.games[idx] = game;
    } else {
      this.games.unshift(game);
    }
    this.saveToDisk();
  }

  async getUserGames(userId: string): Promise<CompletedGameRecord[]> {
    return this.games.filter(
      (g) => g.whiteUserId === userId || g.blackUserId === userId
    );
  }

  async updateLastSeen(userId: string, date: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastSeenAt = date;
      this.saveToDisk();
    }
  }
}

export class ResilientUserRepository implements IUserRepository {
  private inMemory = new InMemoryUserRepository();
  private useMemoryFallback = false;

  constructor(private pgRepo?: PostgresUserRepository) {
    if (!pgRepo) {
      this.useMemoryFallback = true;
    }
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    if (this.useMemoryFallback || !this.pgRepo) {
      return this.inMemory.findByUsername(username);
    }
    try {
      return await this.pgRepo.findByUsername(username);
    } catch {
      this.useMemoryFallback = true;
      return this.inMemory.findByUsername(username);
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (this.useMemoryFallback || !this.pgRepo) {
      return this.inMemory.findById(id);
    }
    try {
      return await this.pgRepo.findById(id);
    } catch {
      this.useMemoryFallback = true;
      return this.inMemory.findById(id);
    }
  }

  async createUser(username: string, passwordHash: string): Promise<UserRecord> {
    if (this.useMemoryFallback || !this.pgRepo) {
      return this.inMemory.createUser(username, passwordHash);
    }
    try {
      return await this.pgRepo.createUser(username, passwordHash);
    } catch {
      this.useMemoryFallback = true;
      return this.inMemory.createUser(username, passwordHash);
    }
  }

  async getUserRatings(userId: string): Promise<UserRatingSummary[]> {
    if (this.useMemoryFallback || !this.pgRepo) {
      return this.inMemory.getUserRatings(userId);
    }
    try {
      return await this.pgRepo.getUserRatings(userId);
    } catch {
      this.useMemoryFallback = true;
      return this.inMemory.getUserRatings(userId);
    }
  }

  async updateUserRating(
    userId: string,
    system: string,
    category: string,
    newRating: number,
    newRd?: number,
    newVolatility?: number
  ): Promise<void> {
    return this.inMemory.updateUserRating(userId, system, category, newRating, newRd, newVolatility);
  }

  async getAllUsers(): Promise<UserRecord[]> {
    return this.inMemory.getAllUsers();
  }

  async updateProfile(userId: string, data: { bio?: string; avatarUrl?: string }): Promise<UserRecord | null> {
    return this.inMemory.updateProfile(userId, data);
  }

  async incrementViews(userId: string): Promise<number> {
    return this.inMemory.incrementViews(userId);
  }

  async recordGame(game: CompletedGameRecord): Promise<void> {
    return this.inMemory.recordGame(game);
  }

  async getUserGames(userId: string): Promise<CompletedGameRecord[]> {
    return this.inMemory.getUserGames(userId);
  }

  async updateLastSeen(userId: string, date: Date): Promise<void> {
    return this.inMemory.updateLastSeen(userId, date);
  }
}

