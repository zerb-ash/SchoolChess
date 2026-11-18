import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import url from 'node:url';
import { registerAuthRoutes, COOKIE_NAME, extractToken } from './routes/auth.js';
import { challengesRoutes, getAllActiveChallenges, cancelChallenge } from './routes/challenges.js';
import { matchmakingRoutes, getAllMatchmakingPlayers, cancelMatchmakingForUser } from './routes/matchmaking.js';
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

  // Fastify JSON body parser allowing empty bodies without 400 Bad Request
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    try {
      if (!body || !body.trim()) {
        return done(null, {});
      }
      done(null, JSON.parse(body));
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
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

  app.options('/api/v1/presence/tunnel', async (req, reply) => {
    const origin = (req.headers.origin as string) || '*';
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Cache-Control, X-Requested-With');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return reply.status(204).send();
  });

  app.get('/api/v1/presence/tunnel', async (req, reply) => {
    const origin = (req.headers.origin as string) || '*';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Cache-Control, X-Requested-With');

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

  // Public user search with pagination
  app.get('/api/v1/users/search', async (req, reply) => {
    const { q = '', page = '1', limit = '10' } = req.query as { q?: string; page?: string; limit?: string };
    const query = q.trim().toLowerCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const allUsers = (await repo.getAllUsers?.()) || [];
    const filtered = query
      ? allUsers.filter((u) => u.username.toLowerCase().includes(query))
      : allUsers;

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const start = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(start, start + limitNum);

    const results = await Promise.all(
      paginated.map(async (u) => {
        const ratingsList = (await repo.getUserRatings(u.id)) || [];
        const fide = ratingsList.find((r) => r.system === 'fide' && r.category === 'blitz')?.rating || 200;
        const rapid = ratingsList.find((r) => r.system === 'fide' && r.category === 'rapid')?.rating || 200;
        const bullet = ratingsList.find((r) => r.system === 'fide' && r.category === 'bullet')?.rating || 200;
        const isOnline = activePresenceSessions.has(u.id);

        return {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl || '',
          bio: u.bio || 'No bio',
          createdAt: u.createdAt,
          lastSeenAt: u.lastSeenAt || u.createdAt,
          views: u.views || 0,
          isOnline,
          rating: fide,
          ratings: { fide, rapid, bullet },
        };
      })
    );

    return reply.send({
      users: results,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
    });
  });

  // Admin validation helper
  const verifyAdmin = (req: any, reply: any): boolean => {
    const token = extractToken(req);
    if (!token) {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Admin authentication required.' });
      return false;
    }
    const session = sessionStore.getSession(token);
    if (!session || session.username.toLowerCase() !== 'admin') {
      reply.code(403).send({ error: 'FORBIDDEN', message: 'Owner / Administrator privileges required.' });
      return false;
    }
    return true;
  };

  // Admin: Analytics & Overview
  app.get('/api/v1/admin/overview', async (req, reply) => {
    if (!verifyAdmin(req, reply)) return;

    const allUsers = (await repo.getAllUsers?.()) || [];
    const completedGames = repo.getAllGames ? await repo.getAllGames() : ((repo as any).games || []);
    const challenges = getAllActiveChallenges();
    const matchmaking = getAllMatchmakingPlayers();

    let runningRooms: any[] = [];
    try {
      const gsRes = await fetch('http://127.0.0.1:4001/internal/rooms');
      if (gsRes.ok) {
        const gsData = (await gsRes.json()) as { rooms?: any[] };
        runningRooms = gsData.rooms || [];
      }
    } catch {
      // Game server might be local
    }

    const onlineUsernames: string[] = [];
    for (const [userId] of activePresenceSessions.entries()) {
      const u = allUsers.find((usr) => usr.id === userId);
      if (u) onlineUsernames.push(u.username);
    }

    return reply.send({
      totalUsers: allUsers.length,
      totalGames: completedGames.length,
      onlineCount: activePresenceSessions.size,
      onlineUsers: onlineUsernames,
      runningGamesCount: runningRooms.length,
      challengesCount: challenges.length,
      matchmakingCount: matchmaking.length,
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
      },
    });
  });

  // Admin: View all running games, challenges, and matchmaking
  app.get('/api/v1/admin/games', async (req, reply) => {
    if (!verifyAdmin(req, reply)) return;

    const { page = '1', limit = '10' } = req.query as { page?: string; limit?: string };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    let liveRooms: any[] = [];
    try {
      const gsRes = await fetch('http://127.0.0.1:4001/internal/rooms');
      if (gsRes.ok) {
        const gsData = (await gsRes.json()) as { rooms?: any[] };
        liveRooms = (gsData.rooms || []).map((r: any) => ({
          type: 'live_game',
          id: r.gameId,
          white: r.white,
          black: r.black,
          fen: r.fen,
          status: r.status,
          timeControl: r.timeControl,
          moveNumber: r.moveNumber,
          startedAt: r.serverTimestamp || Date.now(),
        }));
      }
    } catch {
      // Game server offline
    }

    const challenges = getAllActiveChallenges().map((c) => ({
      type: 'challenge',
      id: c.token,
      gameId: c.gameId,
      creator: { id: c.creatorId, username: c.creatorUsername },
      timeControl: c.timeControl,
      status: c.status,
      shortCode: c.shortCode,
      startedAt: c.createdAt,
    }));

    const matchmaking = getAllMatchmakingPlayers().map((m) => ({
      type: 'matchmaking',
      id: m.userId,
      player: { id: m.userId, username: m.username, rating: m.rating },
      timeControl: m.timeControl,
      status: 'queued',
      startedAt: m.enqueuedAt,
    }));

    const allRunning = [...liveRooms, ...challenges, ...matchmaking];
    const total = allRunning.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const start = (pageNum - 1) * limitNum;
    const paginated = allRunning.slice(start, start + limitNum);

    return reply.send({
      games: paginated,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
    });
  });

  // Admin: Force-terminate running game, challenge, or matchmaking queue
  app.post('/api/v1/admin/games/:id/terminate', async (req, reply) => {
    if (!verifyAdmin(req, reply)) return;

    const { id } = req.params as { id: string };

    // 1. Try terminating in Game-Server
    let terminatedInGs = false;
    try {
      const gsRes = await fetch(`http://127.0.0.1:4001/internal/rooms/${encodeURIComponent(id)}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (gsRes.ok) terminatedInGs = true;
    } catch {}

    // 2. Try cancelling challenge
    const cancelledChallenge = cancelChallenge(id);

    // 3. Try cancelling matchmaking
    const cancelledMm = cancelMatchmakingForUser(id);

    return reply.send({
      success: true,
      message: `Item ${id} ended forcefully.`,
      details: {
        gameRoomTerminated: terminatedInGs,
        challengeCancelled: cancelledChallenge,
        matchmakingCancelled: cancelledMm,
      },
    });
  });

  // Admin: Paginated users directory
  app.get('/api/v1/admin/users', async (req, reply) => {
    if (!verifyAdmin(req, reply)) return;

    const { page = '1', limit = '10', search = '' } = req.query as { page?: string; limit?: string; search?: string };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const term = search.trim().toLowerCase();

    let allUsers = (await repo.getAllUsers?.()) || [];
    if (term) {
      allUsers = allUsers.filter((u) => u.username.toLowerCase().includes(term));
    }

    const total = allUsers.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const start = (pageNum - 1) * limitNum;
    const paginated = allUsers.slice(start, start + limitNum);

    const usersData = await Promise.all(
      paginated.map(async (u) => {
        const ratings = (await repo.getUserRatings(u.id)) || [];
        const games = repo.getUserGames ? (await repo.getUserGames(u.id)) || [] : [];
        return {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl || '',
          bio: u.bio || '',
          views: u.views || 0,
          createdAt: u.createdAt,
          lastSeenAt: u.lastSeenAt || u.createdAt,
          isOnline: activePresenceSessions.has(u.id),
          gamesCount: games.length,
          ratings: {
            fideBlitz: ratings.find((r) => r.system === 'fide' && r.category === 'blitz')?.rating || 200,
            fideRapid: ratings.find((r) => r.system === 'fide' && r.category === 'rapid')?.rating || 200,
            fideBullet: ratings.find((r) => r.system === 'fide' && r.category === 'bullet')?.rating || 200,
          },
        };
      })
    );

    return reply.send({
      users: usersData,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
    });
  });

  // Admin: Paginated game history
  app.get('/api/v1/admin/history', async (req, reply) => {
    if (!verifyAdmin(req, reply)) return;

    const { page = '1', limit = '10' } = req.query as { page?: string; limit?: string };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const completedGames: any[] = repo.getAllGames ? await repo.getAllGames() : ((repo as any).games || []);
    const total = completedGames.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const start = (pageNum - 1) * limitNum;
    const paginated = [...completedGames].reverse().slice(start, start + limitNum);

    return reply.send({
      games: paginated,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
    });
  });

  app.register(challengesRoutes);
  app.register(matchmakingRoutes);

  return app;
}

const isMainModule =
  process.env.pm_id !== undefined ||
  process.env.START_SERVER === 'true' ||
  Boolean(process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href);

if (isMainModule) {
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
