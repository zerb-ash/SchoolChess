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
