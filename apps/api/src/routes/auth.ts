import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RegisterRequestSchema, LoginRequestSchema } from '@schoolchess/shared-types';
import { hashPassword, verifyPassword, runDummyHashVerification } from '../auth/password.js';
import { sessionStore } from '../auth/session.js';
import { IUserRepository } from '../auth/user-repository.js';

export const COOKIE_NAME = 'schoolchess_session';
export const COOKIE_MAX_AGE_SEC = 14 * 24 * 60 * 60;

export function registerAuthRoutes(app: FastifyInstance, userRepo: IUserRepository) {
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = RegisterRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { username, password } = parseResult.data;

    const existing = await userRepo.findByUsername(username);
    if (existing) {
      return reply.status(409).send({
        error: 'USERNAME_TAKEN',
        message: 'This username is already registered.',
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepo.createUser(username, passwordHash);

    const token = sessionStore.createSession(user.id, user.username);

    const isHttps = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
    reply.setCookie(COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_SEC,
    });

    return reply.status(201).send({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    });
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = LoginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.errors.map((e) => e.message),
      });
    }

    const { username, password } = parseResult.data;

    const user = await userRepo.findByUsername(username);
    if (!user) {
      // Prevents timing side-channel attacks by calculating dummy hash
      await runDummyHashVerification();
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      });
    }

    const token = sessionStore.createSession(user.id, user.username);

    const isHttps = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
    reply.setCookie(COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_SEC,
    });

    return reply.status(200).send({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      bio: user.bio || 'No bio',
      avatarUrl: user.avatarUrl || '',
    });
  });

  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[COOKIE_NAME];
    if (token) {
      sessionStore.revokeSession(token);
    }

    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.status(200).send({ success: true });
  });

  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[COOKIE_NAME];
    if (!token) {
      return reply.status(200).send({ user: null });
    }

    const session = sessionStore.getSession(token);
    if (!session) {
      return reply.status(200).send({ user: null });
    }

    const user = await userRepo.findById(session.userId);
    if (!user) {
      return reply.status(200).send({ user: null });
    }

    const ratingsList = await userRepo.getUserRatings(user.id);
    const fide = ratingsList.find((r) => r.system === 'fide')?.rating || 200;
    const chesscom = ratingsList.find((r) => r.system === 'chess_com')?.rating || 200;
    const lichess = ratingsList.find((r) => r.system === 'lichess')?.rating || 200;

    return reply.status(200).send({
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        bio: user.bio || 'No bio',
        avatarUrl: user.avatarUrl || '',
        ratings: { fide, chesscom, lichess },
      },
    });
  });
}

