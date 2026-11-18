import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';

export interface ChallengeData {
  id: string;
  token: string;
  shortCode: string;
  creatorId: string;
  creatorUsername: string;
  timeControl: string;
  side: 'white' | 'black' | 'random';
  rated: boolean;
  status: 'open' | 'accepted' | 'cancelled' | 'expired';
  createdAt: number;
  gameId?: string;
  whitePlayer?: { id: string; username: string };
  blackPlayer?: { id: string; username: string };
}

const activeChallenges = new Map<string, ChallengeData>();
const shortCodeMap = new Map<string, string>();
const challengeRateLimitMap = new Map<string, number[]>();

function checkChallengeRateLimit(identifier: string, isGuest: boolean): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const maxAllowed = isGuest ? 1 : 5;

  const timestamps = (challengeRateLimitMap.get(identifier) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxAllowed) {
    return false;
  }
  timestamps.push(now);
  challengeRateLimitMap.set(identifier, timestamps);
  return true;
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const CreateChallengeSchema = z.object({
  creatorId: z.string().optional(),
  creatorUsername: z.string().min(1).max(30).optional(),
  timeControl: z.enum(['1+0', '3+0', '5+0', '10+0', '15+10', '30+0']).default('5+0'),
  side: z.enum(['white', 'black', 'random']).default('random'),
  rated: z.boolean().default(false),
});

const AcceptChallengeSchema = z.object({
  userId: z.string().optional(),
  username: z.string().min(1).max(30).optional(),
});

export async function challengesRoutes(app: FastifyInstance) {
  app.post('/api/v1/challenges', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseRes = CreateChallengeSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.code(400).send({ message: 'Invalid challenge parameters', errors: parseRes.error.format() });
    }

    const { creatorId, creatorUsername, timeControl, side, rated } = parseRes.data;

    const isGuest = !creatorId || creatorId.startsWith('guest_') || creatorId.startsWith('anon_');
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === 'localhost';
    const rateLimitKey = req.ip || creatorId || 'anon';

    if (!isLocalhost && !checkChallengeRateLimit(rateLimitKey, isGuest)) {
      return reply.code(429).send({
        message: isGuest
          ? 'Guest challenge limit reached (1 challenge per minute). Please create an account for higher limits.'
          : 'Challenge rate limit reached (5 challenges per minute). Please wait.',
      });
    }

    const token = crypto.randomBytes(16).toString('hex');
    let shortCode = generateShortCode();
    while (shortCodeMap.has(shortCode)) {
      shortCode = generateShortCode();
    }

    const effectiveRated = isGuest ? false : rated;

    const challenge: ChallengeData = {
      id: crypto.randomUUID(),
      token,
      shortCode,
      creatorId: creatorId || 'guest_' + crypto.randomBytes(4).toString('hex'),
      creatorUsername: creatorUsername || 'Guest',
      timeControl,
      side,
      rated: effectiveRated,
      status: 'open',
      createdAt: Date.now(),
    };

    activeChallenges.set(token, challenge);
    shortCodeMap.set(shortCode, token);

    return reply.code(201).send({ challenge });
  });

  app.get('/api/v1/challenges/:token', async (req: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = req.params;
    const challenge = activeChallenges.get(token);
    if (!challenge) {
      return reply.code(404).send({ message: 'Challenge not found or expired' });
    }
    return reply.send({ challenge });
  });

  app.delete('/api/v1/challenges/:token', async (req: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = req.params;
    const challenge = activeChallenges.get(token);
    if (challenge) {
      challenge.status = 'cancelled';
      shortCodeMap.delete(challenge.shortCode);
      activeChallenges.delete(token);
    }
    return reply.send({ success: true });
  });

  app.post('/api/v1/challenges/:token/accept', async (req: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = req.params;
    const challenge = activeChallenges.get(token);
    if (!challenge) {
      return reply.code(404).send({ message: 'Challenge not found' });
    }

    if (challenge.status !== 'open') {
      return reply.code(400).send({ message: `Challenge is already ${challenge.status}`, challenge });
    }

    const parseRes = AcceptChallengeSchema.safeParse(req.body);
    const acceptorId = parseRes.success && parseRes.data.userId ? parseRes.data.userId : 'guest_' + crypto.randomBytes(4).toString('hex');
    const acceptorUsername = parseRes.success && parseRes.data.username ? parseRes.data.username : 'Guest';

    const isGuestMatch =
      challenge.creatorId.startsWith('guest_') ||
      challenge.creatorId.startsWith('anon_') ||
      acceptorId.startsWith('guest_') ||
      acceptorId.startsWith('anon_');

    if (isGuestMatch) {
      challenge.rated = false;
    }

    const gameId = 'game_' + crypto.randomUUID();

    let whiteAssignedToCreator = true;
    if (challenge.side === 'white') {
      whiteAssignedToCreator = true;
    } else if (challenge.side === 'black') {
      whiteAssignedToCreator = false;
    } else {
      whiteAssignedToCreator = Math.random() < 0.5;
    }

    challenge.status = 'accepted';
    challenge.gameId = gameId;
    challenge.whitePlayer = whiteAssignedToCreator
      ? { id: challenge.creatorId, username: challenge.creatorUsername }
      : { id: acceptorId, username: acceptorUsername };
    challenge.blackPlayer = whiteAssignedToCreator
      ? { id: acceptorId, username: acceptorUsername }
      : { id: challenge.creatorId, username: challenge.creatorUsername };

    return reply.send({
      gameId,
      challenge,
      yourColor: whiteAssignedToCreator ? 'black' : 'white',
    });
  });

  app.post('/api/v1/challenges/join-code', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { code?: string; userId?: string; username?: string };
    if (!body?.code) {
      return reply.code(400).send({ message: 'Room code is required' });
    }

    const cleanCode = body.code.trim().toUpperCase();
    const token = shortCodeMap.get(cleanCode);
    if (!token) {
      return reply.code(404).send({ message: 'Invalid room code' });
    }

    const challenge = activeChallenges.get(token);
    if (!challenge || challenge.status !== 'open') {
      return reply.code(400).send({ message: 'Challenge is no longer open' });
    }

    return reply.send({ token, challenge });
  });
}
