import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { IUserRepository } from '../auth/user-repository.js';

function getTimeCategory(timeControl?: string): 'bullet' | 'blitz' | 'rapid' | 'classical' {
  if (!timeControl) return 'blitz';
  const [baseStr] = timeControl.split('+');
  const baseMinutes = parseInt(baseStr, 10) || 5;
  if (baseMinutes <= 2) return 'bullet';
  if (baseMinutes <= 5) return 'blitz';
  if (baseMinutes <= 30) return 'rapid';
  return 'classical';
}

interface QueuedPlayer {
  userId: string;
  username: string;
  timeControl: string;
  rating: number;
  enqueuedAt: number;
  queueToken: string;
  matchedGameId?: string;
  assignedColor?: 'white' | 'black';
}

const queues = new Map<string, QueuedPlayer[]>();
const playerLookup = new Map<string, QueuedPlayer>();

function processPairing(timeControl: string): void {
  const pool = queues.get(timeControl) || [];
  if (pool.length < 2) return;

  const now = Date.now();

  for (let i = 0; i < pool.length; i++) {
    const p1 = pool[i];
    if (p1.matchedGameId) continue;

    const waitSeconds1 = Math.max(0, (now - p1.enqueuedAt) / 1000);
    const range1 = Math.min(300, 50 + Math.floor(waitSeconds1 / 2) * 25);

    for (let j = i + 1; j < pool.length; j++) {
      const p2 = pool[j];
      if (p2.matchedGameId || p1.userId === p2.userId) continue;

      const waitSeconds2 = Math.max(0, (now - p2.enqueuedAt) / 1000);
      const range2 = Math.min(300, 50 + Math.floor(waitSeconds2 / 2) * 25);
      const effectiveRange = Math.max(range1, range2);

      const ratingDiff = Math.abs(p1.rating - p2.rating);
      if (ratingDiff <= effectiveRange) {
        const gameId = 'game_' + crypto.randomUUID();
        const p1IsWhite = Math.random() < 0.5;

        p1.matchedGameId = gameId;
        p1.assignedColor = p1IsWhite ? 'white' : 'black';

        p2.matchedGameId = gameId;
        p2.assignedColor = p1IsWhite ? 'black' : 'white';

        const whitePlayer = p1IsWhite ? p1 : p2;
        const blackPlayer = p1IsWhite ? p2 : p1;

        const gsUrl = process.env.GAME_SERVER_INTERNAL_URL || 'http://127.0.0.1:4001';
        fetch(`${gsUrl}/internal/rooms/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId,
            white: { id: whitePlayer.userId, username: whitePlayer.username, rating: whitePlayer.rating },
            black: { id: blackPlayer.userId, username: blackPlayer.username, rating: blackPlayer.rating },
            timeControl,
            rated: true,
          }),
        }).catch(() => {});

        queues.set(
          timeControl,
          pool.filter((p) => p !== p1 && p !== p2)
        );
        return;
      }
    }
  }
}

const JoinQueueSchema = z.object({
  userId: z.string(),
  username: z.string().min(1).max(30),
  timeControl: z.string().min(3).max(10).default('5+0'),
  rating: z.number().int().min(100).max(4000).default(1600),
});

export async function matchmakingRoutes(app: FastifyInstance, repo?: IUserRepository) {
  app.post('/api/v1/matchmaking/join', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseRes = JoinQueueSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.code(400).send({ message: 'Invalid queue request', errors: parseRes.error.format() });
    }

    const { userId, username, timeControl, rating } = parseRes.data;

    let effectiveRating = rating;
    if (repo && userId && !userId.startsWith('guest_') && !userId.startsWith('anon_')) {
      try {
        const cat = getTimeCategory(timeControl);
        const ratings = await repo.getUserRatings(userId);
        const fide = ratings.find((r) => r.system === 'fide' && r.category === cat)?.rating;
        if (fide) effectiveRating = fide;
      } catch {}
    }

    const existing = playerLookup.get(userId);
    if (existing && !existing.matchedGameId) {
      const pool = queues.get(existing.timeControl) || [];
      queues.set(existing.timeControl, pool.filter((p) => p.userId !== userId));
    }

    const queueToken = crypto.randomUUID();
    const queuedPlayer: QueuedPlayer = {
      userId,
      username,
      timeControl,
      rating: effectiveRating,
      enqueuedAt: Date.now(),
      queueToken,
    };

    if (!queues.has(timeControl)) {
      queues.set(timeControl, []);
    }
    queues.get(timeControl)!.push(queuedPlayer);
    playerLookup.set(userId, queuedPlayer);

    processPairing(timeControl);

    if (queuedPlayer.matchedGameId) {
      const res = {
        status: 'matched',
        gameId: queuedPlayer.matchedGameId,
        color: queuedPlayer.assignedColor,
        timeControl,
      };
      playerLookup.delete(userId);
      return reply.send(res);
    }

    return reply.send({
      status: 'queued',
      timeControl,
      queueToken,
    });
  });

  app.get('/api/v1/matchmaking/status', async (req: FastifyRequest<{ Querystring: { userId: string } }>, reply: FastifyReply) => {
    const userId = req.query.userId;
    if (!userId) {
      return reply.code(400).send({ message: 'userId is required' });
    }

    const player = playerLookup.get(userId);
    if (!player) {
      return reply.send({ status: 'idle' });
    }

    if (player.matchedGameId) {
      const res = {
        status: 'matched',
        gameId: player.matchedGameId,
        color: player.assignedColor,
        timeControl: player.timeControl,
      };
      playerLookup.delete(userId);
      return reply.send(res);
    }

    processPairing(player.timeControl);

    if (player.matchedGameId) {
      const res = {
        status: 'matched',
        gameId: player.matchedGameId,
        color: player.assignedColor,
        timeControl: player.timeControl,
      };
      playerLookup.delete(userId);
      return reply.send(res);
    }

    const waitSeconds = Math.max(0, (Date.now() - player.enqueuedAt) / 1000);
    const range = Math.min(300, 50 + Math.floor(waitSeconds / 2) * 25);

    return reply.send({
      status: 'queued',
      waitSeconds: Math.round(waitSeconds),
      ratingRange: range,
      timeControl: player.timeControl,
      queueToken: player.queueToken,
    });
  });

  app.post('/api/v1/matchmaking/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { userId?: string };
    if (!body?.userId) {
      return reply.code(400).send({ message: 'userId is required' });
    }

    const player = playerLookup.get(body.userId);
    if (player) {
      const pool = queues.get(player.timeControl) || [];
      queues.set(
        player.timeControl,
        pool.filter((p) => p.userId !== body.userId)
      );
      playerLookup.delete(body.userId);
    }

    return reply.send({ status: 'cancelled' });
  });
}

export function getAllMatchmakingPlayers(activeUserIds?: Set<string>): QueuedPlayer[] {
  const now = Date.now();
  for (const [userId, p] of playerLookup.entries()) {
    if (
      p.matchedGameId ||
      now - p.enqueuedAt > 10 * 60 * 1000 ||
      (activeUserIds && activeUserIds.has(userId))
    ) {
      cancelMatchmakingForUser(userId);
    }
  }
  return Array.from(playerLookup.values()).filter(
    (p) => !p.matchedGameId && (!activeUserIds || !activeUserIds.has(p.userId))
  );
}

export function cancelMatchmakingForUser(userIdOrPartial: string): boolean {
  let found = false;
  for (const [userId, player] of playerLookup.entries()) {
    if (userId === userIdOrPartial || userId.startsWith(userIdOrPartial) || userIdOrPartial.startsWith(userId)) {
      const pool = queues.get(player.timeControl) || [];
      queues.set(
        player.timeControl,
        pool.filter((p) => p.userId !== userId)
      );
      playerLookup.delete(userId);
      found = true;
    }
  }
  return found;
}

