import { z } from 'zod';

// ==========================================
// 1. HARDENED SYSTEM LIMITS (DDoS / Bloat Protections)
// ==========================================
export const SYSTEM_LIMITS = {
  MAX_BODY_LIMIT_BYTES: 16 * 1024,      // 16 KB hard cap on incoming HTTP JSON bodies
  MAX_WS_FRAME_BYTES: 4 * 1024,         // 4 KB hard cap on individual WebSocket frames
  MAX_USERNAME_LENGTH: 20,
  MIN_USERNAME_LENGTH: 3,
  MAX_PASSWORD_LENGTH: 72,              // 72 chars prevents Argon2/bcrypt CPU exhaustion DoS
  MIN_PASSWORD_LENGTH: 8,
  MAX_CHALLENGE_PER_USER_WINDOW: 5,     // Max challenges created per 10-minute window
  MAX_CONCURRENT_GAMES_PER_USER: 3,
  MAX_WS_MESSAGES_PER_SEC: 10,          // Token bucket cap per socket connection
  DEFAULT_RECONNECT_GRACE_SEC: 60,      // Grace period for player disconnects
} as const;

// ==========================================
// 2. HARDENED AUTHENTICATION SCHEMAS
// (Pure Username + Password, Zero Unicode Exploit Vector)
// ==========================================
export const UsernameRegex = /^[a-zA-Z0-9]+$/;

export const UsernameSchema = z
  .string()
  .min(SYSTEM_LIMITS.MIN_USERNAME_LENGTH, { message: `Username must be at least ${SYSTEM_LIMITS.MIN_USERNAME_LENGTH} characters.` })
  .max(SYSTEM_LIMITS.MAX_USERNAME_LENGTH, { message: `Username cannot exceed ${SYSTEM_LIMITS.MAX_USERNAME_LENGTH} characters.` })
  .regex(UsernameRegex, { message: 'Username can only contain letters and numbers. No spaces or special characters allowed.' })
  .transform((val) => val.trim().toLowerCase());

export const PasswordSchema = z
  .string()
  .min(SYSTEM_LIMITS.MIN_PASSWORD_LENGTH, { message: `Password must be at least ${SYSTEM_LIMITS.MIN_PASSWORD_LENGTH} characters.` })
  .max(SYSTEM_LIMITS.MAX_PASSWORD_LENGTH, { message: `Password cannot exceed ${SYSTEM_LIMITS.MAX_PASSWORD_LENGTH} characters.` });

export const RegisterRequestSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});

export const LoginRequestSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ==========================================
// 3. CHESS DOMAIN & RATING TYPES
// ==========================================
export const RatingSystemEnum = z.enum(['fide', 'chess_com', 'lichess']);
export type RatingSystem = z.infer<typeof RatingSystemEnum>;

export const TimeCategoryEnum = z.enum(['bullet', 'blitz', 'rapid', 'classical', 'untimed']);
export type TimeCategory = z.infer<typeof TimeCategoryEnum>;

export const GameResultEnum = z.enum(['1-0', '0-1', '1/2-1/2', '*']);
export type GameResult = z.infer<typeof GameResultEnum>;

export const GameTerminationEnum = z.enum([
  'checkmate',
  'stalemate',
  'timeout',
  'resignation',
  'draw_agreement',
  'insufficient_material',
  'threefold_repetition',
  'fivefold_repetition',
  'fifty_moves',
  'seventy_five_moves',
  'abandoned',
  'aborted'
]);
export type GameTermination = z.infer<typeof GameTerminationEnum>;

export const PieceColorEnum = z.enum(['w', 'b']);
export type PieceColor = z.infer<typeof PieceColorEnum>;

export const ChessSquareRegex = /^[a-h][1-8]$/;
export const ChessSquareSchema = z.string().regex(ChessSquareRegex, { message: 'Must be a valid algebraic square (e.g., e4, g1)' });

// ==========================================
// 4. WEBSOCKET PACKET SCHEMAS (Sub-50ms Hot-Path)
// ==========================================
export const MoveSubmissionSchema = z.object({
  gameId: z.string().min(1),
  from: ChessSquareSchema,
  to: ChessSquareSchema,
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  expectedMoveNumber: z.number().int().min(0),
  idempotencyKey: z.string().min(1),
});
export type MoveSubmission = z.infer<typeof MoveSubmissionSchema>;

export const GameJoinSchema = z.object({
  gameId: z.string().min(1),
  preferredColor: z.enum(['white', 'black']).optional(),
  timeControl: z.string().optional(),
  rating: z.number().optional(),
});
export type GameJoin = z.infer<typeof GameJoinSchema>;

export const DrawActionSchema = z.object({
  gameId: z.string().min(1),
  action: z.enum(['offer', 'accept', 'decline', 'claim_repetition', 'claim_fifty']),
});
export type DrawAction = z.infer<typeof DrawActionSchema>;

export const ResignSchema = z.object({
  gameId: z.string().min(1),
});
export type ResignPayload = z.infer<typeof ResignSchema>;

// Outgoing Realtime Events
export interface MoveAppliedEvent {
  gameId: string;
  move: {
    from: string;
    to: string;
    san: string;
    uci: string;
    promotion?: 'q' | 'r' | 'b' | 'n';
  };
  fen: string;
  turn: PieceColor;
  moveNumber: number;
  whiteClockMs: number;
  blackClockMs: number;
  isCheck: boolean;
  serverTimestamp: number;
}

export interface GameStateEvent {
  gameId: string;
  white: { id: string; username: string; rating: number };
  black: { id: string; username: string; rating: number };
  fen: string;
  turn: PieceColor;
  moveNumber: number;
  whiteClockMs: number;
  blackClockMs: number;
  timeControl: string;
  status: 'pending' | 'active' | 'completed' | 'aborted';
  history?: string[];
  serverTimestamp: number;
}

// ==========================================
// 5. RATING CALCULATION MODELS
// ==========================================
export interface FideEloState {
  rating: number;
  gamesPlayed: number;
  isUnder18?: boolean;
}

export interface Glicko1State {
  rating: number;
  rd: number; // Rating Deviation
  lastPlayedAt?: Date | number;
}

export interface Glicko2State {
  rating: number;
  rd: number;
  volatility: number; // sigma
}

export interface RatingCalculationResult {
  newRating: number;
  newRd?: number;
  newVolatility?: number;
  ratingDelta: number;
  isProvisional: boolean;
}

