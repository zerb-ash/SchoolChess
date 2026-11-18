import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import url from 'node:url';
import { registerAuthRoutes, COOKIE_NAME, extractToken } from './routes/auth.js';
import { challengesRoutes } from './routes/challenges.js';
import { matchmakingRoutes } from './routes/matchmaking.js';
import { sessionStore } from './auth/session.js';
import { IUserRepository, InMemoryUserRepository, PostgresUserRepository, ResilientUserRepository } from './auth/user-repository.js';
import { createDatabaseClient } from '@schoolchess/database';
import { calculateTriRating } from '@schoolchess/ratings';

export function getTimeCategory(timeControl?: string): 'bullet' | 'blitz' | 'rapid' | 'classical' {
  if (!timeControl) return 'blitz';
  const [baseStr] = timeControl.split('+');
  const baseMinutes = parseInt(baseStr, 10) || 5;
  if (baseMinutes <= 2) return 'bullet';
  if (baseMinutes <= 5) return 'blitz';
  if (baseMinutes <= 30) return 'rapid';
  return 'classical';
}

export function buildServer(userRepo?: IUserRepository) {
  const app = fastify({
    bodyLimit: 16384,
    trustProxy: true,
  });

  app.register(cookie);
  app.register(cors, {
    origin: true,
    credentials: true,
  });

  const repo = userRepo || (() => {
    if (process.env.DATABASE_URL) {
      try {
        const { db } = createDatabaseClient();
        return new ResilientUserRepository(new PostgresUserRepository(db));
      } catch {
        return new InMemoryUserRepository();
      }
    }
    return new InMemoryUserRepository();
  })();

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  app.get('/api/v1/leaderboards', async (req) => {
    const query = req.query as { system?: string; category?: string };
    const system = query.system || 'fide';
    const category = query.category || 'blitz';

    if (!repo.getAllUsers) {
      return { entries: [] };
    }

    const allUsers = await repo.getAllUsers();
    const entries = [];

    for (const u of allUsers) {
      const ratings = await repo.getUserRatings(u.id);
      const match = ratings.find((r) => r.system === system && r.category === category);
      if (match) {
        const userGames = repo.getUserGames ? await repo.getUserGames(u.id) : [];
        const relevantGames = userGames.filter((g) => g.category === category);
        const totalGames = relevantGames.length;
        const wins = relevantGames.filter(
          (g) => (g.whiteUserId === u.id && g.result === '1-0') || (g.blackUserId === u.id && g.result === '0-1')
        ).length;
        const winRate = totalGames > 0 ? `${Math.round((wins / totalGames) * 100)}%` : '0%';

        entries.push({
          userId: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl || null,
          rating: match.rating,
          provisional: match.provisional,
          games: totalGames,
          winRate,
        });
      }
    }

    entries.sort((a, b) => b.rating - a.rating);
    const rankedEntries = entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
    return { entries: rankedEntries };
  });

  app.post('/api/v1/games/finish', async (req, reply) => {
    const body = req.body as {
      gameId: string;
      timeControl?: string;
      whiteUserId: string;
      whiteUsername: string;
      blackUserId: string;
      blackUsername: string;
      result: '1-0' | '0-1' | '1/2-1/2';
      termination: string;
      movesCount?: number;
      finalFen?: string;
      rated?: boolean;
    };

    const {
      gameId,
      timeControl = '5+0',
      whiteUserId,
      whiteUsername,
      blackUserId,
      blackUsername,
      result,
      termination,
      movesCount = 0,
      finalFen,
    } = body;

    const category = getTimeCategory(timeControl);

    const whiteUser = await repo.findById(whiteUserId);
    const blackUser = await repo.findById(blackUserId);

    const isGuestMatch =
      !whiteUser ||
      !blackUser ||
      whiteUserId === blackUserId ||
      whiteUserId.startsWith('guest_') ||
      blackUserId.startsWith('guest_');

    const shouldRate =
      body.rated !== false &&
      !isGuestMatch &&
      termination !== 'aborted' &&
      (result as string) !== '*';

    let whiteRatingUpdates: Record<string, number> = {};
    let blackRatingUpdates: Record<string, number> = {};

    if (shouldRate && whiteUser && blackUser && repo.updateUserRating) {
      const whiteRatings = await repo.getUserRatings(whiteUser.id);
      const blackRatings = await repo.getUserRatings(blackUser.id);

      const whiteFideObj = whiteRatings.find((r) => r.system === 'fide' && r.category === category);
      const blackFideObj = blackRatings.find((r) => r.system === 'fide' && r.category === category);
      const whiteFide = whiteFideObj?.rating || 200;
      const blackFide = blackFideObj?.rating || 200;
      const whiteFideGames = whiteFideObj?.gamesCount || 0;
      const blackFideGames = blackFideObj?.gamesCount || 0;

      const whiteChessComObj = whiteRatings.find((r) => r.system === 'chess_com' && r.category === category);
      const blackChessComObj = blackRatings.find((r) => r.system === 'chess_com' && r.category === category);
      const whiteChessCom = whiteChessComObj?.rating || 200;
      const blackChessCom = blackChessComObj?.rating || 200;
      const whiteChessComRd = whiteChessComObj?.rd || 350;
      const blackChessComRd = blackChessComObj?.rd || 350;

      const whiteLichessObj = whiteRatings.find((r) => r.system === 'lichess' && r.category === category);
      const blackLichessObj = blackRatings.find((r) => r.system === 'lichess' && r.category === category);
      const whiteLichess = whiteLichessObj?.rating || 200;
      const blackLichess = blackLichessObj?.rating || 200;
      const whiteLichessRd = whiteLichessObj?.rd || 350;
      const blackLichessRd = blackLichessObj?.rd || 350;
      const whiteLichessVol = whiteLichessObj?.volatility || 0.06;
      const blackLichessVol = blackLichessObj?.volatility || 0.06;

      const whiteScore = result === '1-0' ? 1.0 : result === '0-1' ? 0.0 : 0.5;

      const triResult = calculateTriRating(
        {
          fide: { rating: whiteFide, gamesPlayed: whiteFideGames },
          chessCom: { rating: whiteChessCom, rd: whiteChessComRd },
          lichess: { rating: whiteLichess, rd: whiteLichessRd, volatility: whiteLichessVol },
        },
        {
          fide: { rating: blackFide, gamesPlayed: blackFideGames },
          chessCom: { rating: blackChessCom, rd: blackChessComRd },
          lichess: { rating: blackLichess, rd: blackLichessRd, volatility: blackLichessVol },
        },
        whiteScore
      );

      await repo.updateUserRating(whiteUser.id, 'fide', category, triResult.white.fide.newRating);
      await repo.updateUserRating(whiteUser.id, 'chess_com', category, triResult.white.chessCom.newRating, triResult.white.chessCom.newRd);
      await repo.updateUserRating(whiteUser.id, 'lichess', category, triResult.white.lichess.newRating, triResult.white.lichess.newRd, triResult.white.lichess.newVolatility);

      await repo.updateUserRating(blackUser.id, 'fide', category, triResult.black.fide.newRating);
      await repo.updateUserRating(blackUser.id, 'chess_com', category, triResult.black.chessCom.newRating, triResult.black.chessCom.newRd);
      await repo.updateUserRating(blackUser.id, 'lichess', category, triResult.black.lichess.newRating, triResult.black.lichess.newRd, triResult.black.lichess.newVolatility);

      whiteRatingUpdates = {
        fide: triResult.white.fide.newRating,
        chess_com: triResult.white.chessCom.newRating,
        lichess: triResult.white.lichess.newRating,
      };
      blackRatingUpdates = {
        fide: triResult.black.fide.newRating,
        chess_com: triResult.black.chessCom.newRating,
        lichess: triResult.black.lichess.newRating,
      };
    }

    if (whiteUser && blackUser && whiteUser.id !== blackUser.id && repo.recordGame) {
      const whiteRatings = await repo.getUserRatings(whiteUser.id);
      const blackRatings = await repo.getUserRatings(blackUser.id);
      const wRating = whiteRatings.find((r) => r.system === 'fide' && r.category === category)?.rating || 200;
      const bRating = blackRatings.find((r) => r.system === 'fide' && r.category === category)?.rating || 200;

      await repo.recordGame({
        id: gameId,
        timeControl,
        category,
        whiteUserId: whiteUser.id,
        whiteUsername: whiteUser.username,
        whiteRating: wRating,
        whiteAvatarUrl: whiteUser.avatarUrl,
        blackUserId: blackUser.id,
        blackUsername: blackUser.username,
        blackRating: bRating,
        blackAvatarUrl: blackUser.avatarUrl,
        result,
        termination,
        movesCount,
        finalFen,
        playedAt: new Date(),
      });
    }

    return reply.send({
      success: true,
      rated: shouldRate,
      whiteRatingUpdates,
      blackRatingUpdates,
    });
  });

  const activePresenceSessions = new Map<string, number>();

  app.get('/api/v1/presence/tunnel', async (req, reply) => {
    const token = extractToken(req);
    if (!token) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const session = sessionStore.getSession(token);
    if (!session) {
      return reply.code(401).send({ message: 'Session expired' });
    }

    const userId = session.userId;
    const currentCount = activePresenceSessions.get(userId) || 0;
    activePresenceSessions.set(userId, currentCount + 1);

    if (repo.updateLastSeen) {
      await repo.updateLastSeen(userId, new Date());
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    reply.raw.write(': connected\n\n');

    const pingInterval = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.raw.on('close', async () => {
      clearInterval(pingInterval);
      const remaining = (activePresenceSessions.get(userId) || 1) - 1;
      if (remaining <= 0) {
        activePresenceSessions.delete(userId);
        if (repo.updateLastSeen) {
          await repo.updateLastSeen(userId, new Date());
        }
      } else {
        activePresenceSessions.set(userId, remaining);
      }
    });
  });

  app.get('/api/v1/users/:username', async (req, reply) => {
    let { username } = req.params as { username: string };
    if (username.startsWith('@')) username = username.substring(1);

    const user = await repo.findByUsername(username);
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const ratingsList = await repo.getUserRatings(user.id);
    const ratingsMap: Record<string, number> = {
      rapid: 200,
      blitz: 200,
      bullet: 200,
    };

    for (const r of ratingsList) {
      if (r.category in ratingsMap) {
        ratingsMap[r.category] = r.rating;
      }
    }

    const rawGames = repo.getUserGames ? await repo.getUserGames(user.id) : [];
    const games = await Promise.all(
      rawGames.map(async (g) => {
        let whiteAvatar = g.whiteAvatarUrl;
        let blackAvatar = g.blackAvatarUrl;
        if (!whiteAvatar && g.whiteUserId) {
          const wUser = await repo.findById(g.whiteUserId);
          whiteAvatar = wUser?.avatarUrl;
        }
        if (!blackAvatar && g.blackUserId) {
          const bUser = await repo.findById(g.blackUserId);
          blackAvatar = bUser?.avatarUrl;
        }
        return {
          ...g,
          whiteAvatarUrl: whiteAvatar || '',
          blackAvatarUrl: blackAvatar || '',
        };
      })
    );
    const isOnline = activePresenceSessions.has(user.id);

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        bio: user.bio || 'No bio',
        avatarUrl: user.avatarUrl || '',
        views: user.views || 0,
        createdAt: user.createdAt,
        lastSeenAt: isOnline ? new Date().toISOString() : (user.lastSeenAt || user.createdAt).toISOString(),
        isOnline,
      },
      ratings: ratingsMap,
      games,
    });
  });

  app.put('/api/v1/users/:username', async (req, reply) => {
    let { username } = req.params as { username: string };
    if (username.startsWith('@')) username = username.substring(1);

    const user = await repo.findByUsername(username);
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const body = req.body as { bio?: string; avatarUrl?: string };
    if (repo.updateProfile) {
      const updated = await repo.updateProfile(user.id, body);
      return reply.send({ user: updated });
    }

    return reply.send({ user });
  });

  app.post('/api/v1/users/:username/view', async (req, reply) => {
    let { username } = req.params as { username: string };
    if (username.startsWith('@')) username = username.substring(1);

    const user = await repo.findByUsername(username);
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }

    const token = extractToken(req);
    const session = token ? sessionStore.getSession(token) : null;
    if (session && session.userId === user.id) {
      return reply.send({ views: user.views || 0, skipped: true });
    }

    const views = repo.incrementViews ? await repo.incrementViews(user.id) : (user.views || 0) + 1;
    return reply.send({ views });
  });

  app.register(
    async (authScope) => {
      registerAuthRoutes(authScope, repo);
    },
    { prefix: '/api/v1/auth' }
  );

  app.register(challengesRoutes);
  app.register(matchmakingRoutes);

  return app;
}

const isMainModule = process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (isMainModule || process.env.START_SERVER === 'true') {
  const app = buildServer();
  const port = parseInt(process.env.PORT || '4000', 10);
  app.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`SchoolChess API server running on ${address}`);
  });
}
