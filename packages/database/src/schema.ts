import {
  pgTable, uuid, varchar, text, boolean, integer,
  doublePrecision, timestamp, bigint, char, uniqueIndex, index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 20 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  isVerified: boolean('is_verified').default(false).notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
  accountStatus: varchar('account_status', { length: 20 }).default('active').notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  lowerUsernameIdx: uniqueIndex('uq_users_lower_username').on(sql`lower(${table.username})`)
}));

export const userRatings = pgTable('user_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  system: varchar('system', { length: 20 }).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  rating: doublePrecision('rating').notNull(),
  ratingDeviation: doublePrecision('rating_deviation'),
  volatility: doublePrecision('volatility'),
  kFactor: integer('k_factor'),
  gamesPlayed: integer('games_played').default(0).notNull(),
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
  draws: integer('draws').default(0).notNull(),
  peakRating: doublePrecision('peak_rating').notNull(),
  provisional: boolean('provisional').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userSystemCatIdx: uniqueIndex('uq_user_system_category').on(table.userId, table.system, table.category),
  systemCatRatingIdx: index('idx_system_cat_rating').on(table.system, table.category, table.rating)
}));

export const externalRatings = pgTable('external_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 20 }).notNull(),
  ratingType: varchar('rating_type', { length: 20 }).notNull(),
  rating: doublePrecision('rating').notNull(),
  externalPlayerId: varchar('external_player_id', { length: 64 }),
  verified: boolean('verified').default(false).notNull(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userProviderTypeIdx: uniqueIndex('uq_user_provider_type').on(table.userId, table.provider, table.ratingType)
}));

export const ratingHistory = pgTable('rating_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id').notNull(),
  system: varchar('system', { length: 20 }).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  oldRating: doublePrecision('old_rating').notNull(),
  newRating: doublePrecision('new_rating').notNull(),
  ratingChange: doublePrecision('rating_change').notNull(),
  oldDeviation: doublePrecision('old_deviation'),
  newDeviation: doublePrecision('new_deviation'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userHistoryIdx: index('idx_rating_history_user_time').on(table.userId, table.createdAt)
}));

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  whiteUserId: uuid('white_user_id').references(() => users.id),
  blackUserId: uuid('black_user_id').references(() => users.id),
  isBotGame: boolean('is_bot_game').default(false).notNull(),
  botDifficulty: varchar('bot_difficulty', { length: 30 }),
  timeControl: varchar('time_control', { length: 30 }).notNull(),
  baseTimeSeconds: integer('base_time_seconds').notNull(),
  incrementSeconds: integer('increment_seconds').default(0).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  rated: boolean('rated').default(true).notNull(),
  variant: varchar('variant', { length: 30 }).default('standard').notNull(),
  initialFen: text('initial_fen').notNull(),
  currentFen: text('current_fen').notNull(),
  pgn: text('pgn').default('').notNull(),
  result: varchar('result', { length: 10 }),
  termination: varchar('termination', { length: 40 }),
  winnerId: uuid('winner_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true })
}, (table) => ({
  whiteUserIdx: index('idx_games_white_user').on(table.whiteUserId),
  blackUserIdx: index('idx_games_black_user').on(table.blackUserId),
  statusIdx: index('idx_games_status').on(table.status)
}));

export const gameMoves = pgTable('game_moves', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  moveNumber: integer('move_number').notNull(),
  color: char('color', { length: 1 }).notNull(),
  fromSquare: varchar('from_square', { length: 4 }).notNull(),
  toSquare: varchar('to_square', { length: 4 }).notNull(),
  promotion: varchar('promotion', { length: 2 }),
  san: varchar('san', { length: 12 }).notNull(),
  uci: varchar('uci', { length: 10 }).notNull(),
  fenAfter: text('fen_after').notNull(),
  whiteClockMs: integer('white_clock_ms').notNull(),
  blackClockMs: integer('black_clock_ms').notNull(),
  durationMs: integer('duration_ms').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  gameSeqIdx: index('idx_game_moves_game_seq').on(table.gameId, table.moveNumber)
}));

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  joinCodeHash: varchar('join_code_hash', { length: 64 }).unique(),
  timeControl: varchar('time_control', { length: 30 }).notNull(),
  baseTimeSeconds: integer('base_time_seconds').notNull(),
  incrementSeconds: integer('increment_seconds').default(0).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  rated: boolean('rated').default(false).notNull(),
  colorPreference: varchar('color_preference', { length: 10 }).default('random').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  gameId: uuid('game_id').references(() => games.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const userStatistics = pgTable('user_statistics', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  totalGames: integer('total_games').default(0).notNull(),
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
  draws: integer('draws').default(0).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  bestStreak: integer('best_streak').default(0).notNull(),
  checkmatesDelivered: integer('checkmates_delivered').default(0).notNull(),
  resignationsGiven: integer('resignations_given').default(0).notNull(),
  timeoutWins: integer('timeout_wins').default(0).notNull(),
  whiteGamesPlayed: integer('white_games_played').default(0).notNull(),
  whiteWins: integer('white_wins').default(0).notNull(),
  blackGamesPlayed: integer('black_games_played').default(0).notNull(),
  blackWins: integer('black_wins').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  privacyOpponentProfile: boolean('privacy_opponent_profile').default(true).notNull(),
  privacyGameVisibility: varchar('privacy_game_visibility', { length: 20 }).default('public').notNull(),
  allowChallengesFrom: varchar('allow_challenges_from', { length: 20 }).default('anyone').notNull(),
  notifyOnChallenge: boolean('notify_on_challenge').default(true).notNull(),
  notifyOnMove: boolean('notify_on_move').default(true).notNull(),
  preferredRatingSystem: varchar('preferred_rating_system', { length: 20 }).default('chess_com').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
