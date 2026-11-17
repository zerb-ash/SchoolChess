import { eq, sql } from 'drizzle-orm';
import { DatabaseInstance, users, userRatings, userStatistics, userSettings } from '@schoolchess/database';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

export interface UserRatingSummary {
  system: string;
  category: string;
  rating: number;
  provisional: boolean;
}

export interface IUserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  createUser(username: string, passwordHash: string): Promise<UserRecord>;
  getUserRatings(userId: string): Promise<UserRatingSummary[]>;
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
            rating: sys === 'fide' ? 1400 : 1500,
            ratingDeviation: sys === 'fide' ? null : 350,
            volatility: sys === 'lichess' ? 0.06 : null,
            kFactor: sys === 'fide' ? 40 : null,
            peakRating: sys === 'fide' ? 1400 : 1500,
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
          rating: sys === 'fide' ? 1400 : 1500,
          provisional: true,
        });
      }
    }

    this.ratings.set(id, userRatingList);
    return record;
  }

  async getUserRatings(userId: string): Promise<UserRatingSummary[]> {
    return this.ratings.get(userId) ?? [];
  }
}

