import fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import url from 'node:url';
import { WebSocket } from 'ws';
import { roomManager } from './rooms/room-manager.js';
import { MoveSubmissionSchema, DrawActionSchema, ResignSchema, GameJoinSchema } from '@schoolchess/shared-types';

export function buildGameServer() {
  const app = fastify({
    bodyLimit: 16384,
  });

  app.register(cors, { origin: true });
  app.register(websocket, {
    options: {
      maxPayload: 4096, // 4 KB hard frame cap
    },
  });

  app.get('/health', async () => {
    return { status: 'ok', activeRooms: roomManager.getActiveCount(), uptime: process.uptime() };
  });

  app.register(async (wsScope) => {
    wsScope.get('/ws/game', { websocket: true }, (socket: WebSocket, req) => {
      let activeGameId: string | null = null;
      const parsedUrl = new URL(req.url || '', 'http://localhost');
      const authenticatedUserId =
        (req.query as any)?.userId ||
        parsedUrl.searchParams.get('userId') ||
        `guest_${Math.random().toString(36).substring(2, 8)}`;
      const authenticatedUsername =
        (req.query as any)?.username ||
        parsedUrl.searchParams.get('username') ||
        (authenticatedUserId.startsWith('guest_') ? 'Guest' : 'Player');
      let messageCountInWindow = 0;
      let windowStart = Date.now();

      socket.on('message', (rawData) => {
        const now = Date.now();
        if (now - windowStart > 1000) {
          windowStart = now;
          messageCountInWindow = 0;
        }
        messageCountInWindow += 1;

        if (messageCountInWindow > 20) {
          socket.close(4429, 'RATE_LIMIT_EXCEEDED');
          return;
        }

        try {
          const msg = JSON.parse(rawData.toString());

          switch (msg.type) {
            case 'game:join': {
              const parse = GameJoinSchema.safeParse(msg.payload);
              if (!parse.success) return;
              const { gameId } = parse.data;

              activeGameId = gameId;

              let room = roomManager.getRoom(gameId);
              if (!room) {
                room = roomManager.getOrCreateRoom({
                  gameId,
                  white: { id: authenticatedUserId, username: authenticatedUsername, rating: 200 },
                  black: { id: '', username: 'Waiting...', rating: 200 },
                  baseTimeSeconds: 300,
                  incrementSeconds: 0,
                  rated: true,
                });
              } else if (
                room.white.id !== authenticatedUserId &&
                (!room.black.id || room.black.id === 'opponent_placeholder' || room.black.id === '')
              ) {
                room.setBlackPlayer({
                  id: authenticatedUserId,
                  username: authenticatedUsername,
                  rating: 200,
                });
              }

              room.addSocket(socket, authenticatedUserId);
              break;
            }

            case 'game:move': {
              const parse = MoveSubmissionSchema.safeParse(msg.payload);
              if (!parse.success || !activeGameId) return;

              const room = roomManager.getRoom(activeGameId);
              if (room) {
                room.applyMove(authenticatedUserId, parse.data, socket);
              }
              break;
            }

            case 'game:draw_action': {
              const parse = DrawActionSchema.safeParse(msg.payload);
              if (!parse.success || !activeGameId) return;

              const room = roomManager.getRoom(activeGameId);
              if (room) {
                room.handleDrawAction(authenticatedUserId, parse.data.action);
              }
              break;
            }

            case 'game:resign': {
              const parse = ResignSchema.safeParse(msg.payload);
              if (!parse.success || !activeGameId) return;

              const room = roomManager.getRoom(activeGameId);
              if (room) {
                room.handleResign(authenticatedUserId);
              }
              break;
            }

            case 'client:ping': {
              socket.send(JSON.stringify({ type: 'server:pong', payload: { t: Date.now() } }));
              break;
            }
          }
        } catch {
          // Drop invalid frames safely
        }
      });

      socket.on('close', () => {
        if (activeGameId) {
          const room = roomManager.getRoom(activeGameId);
          if (room) {
            room.removeSocket(socket, authenticatedUserId);
          }
        }
      });
    });
  });

  return app;
}

const isMainModule = process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (isMainModule || process.env.START_SERVER === 'true') {
  const app = buildGameServer();
  const port = parseInt(process.env.PORT || '4001', 10);
  app.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`SchoolChess Game WebSocket Server running on ${address}`);
  });
}

