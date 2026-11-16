import { z } from 'zod';
export declare const SYSTEM_LIMITS: {
    readonly MAX_BODY_LIMIT_BYTES: number;
    readonly MAX_WS_FRAME_BYTES: number;
    readonly MAX_USERNAME_LENGTH: 20;
    readonly MIN_USERNAME_LENGTH: 3;
    readonly MAX_PASSWORD_LENGTH: 72;
    readonly MIN_PASSWORD_LENGTH: 8;
    readonly MAX_CHALLENGE_PER_USER_WINDOW: 5;
    readonly MAX_CONCURRENT_GAMES_PER_USER: 3;
    readonly MAX_WS_MESSAGES_PER_SEC: 10;
    readonly DEFAULT_RECONNECT_GRACE_SEC: 60;
};
export declare const UsernameRegex: RegExp;
export declare const UsernameSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const PasswordSchema: z.ZodString;
export declare const RegisterRequestSchema: z.ZodObject<{
    username: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export declare const LoginRequestSchema: z.ZodObject<{
    username: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export declare const RatingSystemEnum: z.ZodEnum<["fide", "chess_com", "lichess"]>;
export type RatingSystem = z.infer<typeof RatingSystemEnum>;
export declare const TimeCategoryEnum: z.ZodEnum<["bullet", "blitz", "rapid", "classical", "untimed"]>;
export type TimeCategory = z.infer<typeof TimeCategoryEnum>;
export declare const GameResultEnum: z.ZodEnum<["1-0", "0-1", "1/2-1/2", "*"]>;
export type GameResult = z.infer<typeof GameResultEnum>;
export declare const GameTerminationEnum: z.ZodEnum<["checkmate", "stalemate", "timeout", "resignation", "draw_agreement", "insufficient_material", "threefold_repetition", "fivefold_repetition", "fifty_moves", "seventy_five_moves", "abandoned"]>;
export type GameTermination = z.infer<typeof GameTerminationEnum>;
export declare const PieceColorEnum: z.ZodEnum<["w", "b"]>;
export type PieceColor = z.infer<typeof PieceColorEnum>;
export declare const ChessSquareRegex: RegExp;
export declare const ChessSquareSchema: z.ZodString;
export declare const MoveSubmissionSchema: z.ZodObject<{
    gameId: z.ZodString;
    from: z.ZodString;
    to: z.ZodString;
    promotion: z.ZodOptional<z.ZodEnum<["q", "r", "b", "n"]>>;
    expectedMoveNumber: z.ZodNumber;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gameId: string;
    from: string;
    to: string;
    expectedMoveNumber: number;
    idempotencyKey: string;
    promotion?: "b" | "q" | "r" | "n" | undefined;
}, {
    gameId: string;
    from: string;
    to: string;
    expectedMoveNumber: number;
    idempotencyKey: string;
    promotion?: "b" | "q" | "r" | "n" | undefined;
}>;
export type MoveSubmission = z.infer<typeof MoveSubmissionSchema>;
export declare const GameJoinSchema: z.ZodObject<{
    gameId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gameId: string;
}, {
    gameId: string;
}>;
export type GameJoin = z.infer<typeof GameJoinSchema>;
export declare const DrawActionSchema: z.ZodObject<{
    gameId: z.ZodString;
    action: z.ZodEnum<["offer", "accept", "decline", "claim_repetition", "claim_fifty"]>;
}, "strip", z.ZodTypeAny, {
    gameId: string;
    action: "offer" | "accept" | "decline" | "claim_repetition" | "claim_fifty";
}, {
    gameId: string;
    action: "offer" | "accept" | "decline" | "claim_repetition" | "claim_fifty";
}>;
export type DrawAction = z.infer<typeof DrawActionSchema>;
export declare const ResignSchema: z.ZodObject<{
    gameId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gameId: string;
}, {
    gameId: string;
}>;
export type ResignPayload = z.infer<typeof ResignSchema>;
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
    white: {
        id: string;
        username: string;
        rating: number;
    };
    black: {
        id: string;
        username: string;
        rating: number;
    };
    fen: string;
    turn: PieceColor;
    moveNumber: number;
    whiteClockMs: number;
    blackClockMs: number;
    timeControl: string;
    status: 'pending' | 'active' | 'completed' | 'aborted';
    serverTimestamp: number;
}
export interface FideEloState {
    rating: number;
    gamesPlayed: number;
    isUnder18?: boolean;
}
export interface Glicko1State {
    rating: number;
    rd: number;
    lastPlayedAt?: Date | number;
}
export interface Glicko2State {
    rating: number;
    rd: number;
    volatility: number;
}
export interface RatingCalculationResult {
    newRating: number;
    newRd?: number;
    newVolatility?: number;
    ratingDelta: number;
    isProvisional: boolean;
}
//# sourceMappingURL=index.d.ts.map