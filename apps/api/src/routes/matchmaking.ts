import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';

interface QueuedPlayer {
  userId: string;
  username: string;
  timeControl: string;
  rating: number;
  enqueuedAt: number;
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

export async function matchmakingRoutes(app: FastifyInstance) {
  app.post('/api/v1/matchmaking/join', async (req: FastifyRequest, reply: FastifyReply) => {
    const parseRes = JoinQueueSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.code(400).send({ message: 'Invalid queue request', errors: parseRes.error.format() });
    }

    const { userId, username, timeControl, rating } = parseRes.data;

    const existing = playerLookup.get(userId);
    if (existing && !existing.matchedGameId) {
      const pool = queues.get(existing.timeControl) || [];
      queues.set(existing.timeControl, pool.filter((p) => p.userId !== userId));
    }

    const queuedPlayer: QueuedPlayer = {
      userId,
      username,
      timeControl,
      rating,
      enqueuedAt: Date.now(),
    };

    if (!queues.has(timeControl)) {
      queues.set(timeControl, []);
    }
    queues.get(timeControl)!.push(queuedPlayer);
    playerLookup.set(userId, queuedPlayer);

    processPairing(timeControl);

    return reply.send({
      status: queuedPlayer.matchedGameId ? 'matched' : 'queued',
      gameId: queuedPlayer.matchedGameId,
      color: queuedPlayer.assignedColor,
      timeControl,
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

export function getAllMatchmakingPlayers(): QueuedPlayer[] {
  const now = Date.now();
  for (const [userId, p] of playerLookup.entries()) {
    if (now - p.enqueuedAt > 10 * 60 * 1000) {
      cancelMatchmakingForUser(userId);
    }
  }
  return Array.from(playerLookup.values());
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

