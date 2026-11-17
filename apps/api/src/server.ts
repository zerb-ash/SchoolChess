import fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import url from 'node:url';
import { registerAuthRoutes } from './routes/auth.js';
import { challengesRoutes } from './routes/challenges.js';
import { matchmakingRoutes } from './routes/matchmaking.js';
import { IUserRepository, InMemoryUserRepository, PostgresUserRepository, ResilientUserRepository } from './auth/user-repository.js';
import { createDatabaseClient } from '@schoolchess/database';

export function buildServer(userRepo?: IUserRepository) {
  const app = fastify({
    bodyLimit: 16384,
  });

  app.register(cookie);
  app.register(cors, {
    origin: true,
    credentials: true,
  });

  const repo = userRepo || (() => {
    try {
      const { db } = createDatabaseClient();
      return new ResilientUserRepository(new PostgresUserRepository(db));
    } catch {
      return new InMemoryUserRepository();
    }
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
        entries.push({
          userId: u.id,
          username: u.username,
          rating: match.rating,
          provisional: match.provisional,
          games: 0,
          winRate: '0%',
        });
      }
    }

    entries.sort((a, b) => b.rating - a.rating);
    return { entries };
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

    const games = repo.getUserGames ? await repo.getUserGames(user.id) : [];

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
        views: user.views || 0,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt || user.createdAt,
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
