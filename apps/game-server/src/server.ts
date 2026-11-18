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

  app.get('/internal/rooms', async () => {
    return { rooms: roomManager.getAllRooms() };
  });

  app.post('/internal/rooms/:gameId/terminate', async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    let room = roomManager.getRoom(gameId);
    if (!room) {
      for (const r of roomManager.getAllRawRooms()) {
        if (r.gameId === gameId || r.gameId.includes(gameId) || gameId.includes(r.gameId)) {
          room = r;
          break;
        }
      }
    }
    if (!room) {
      roomManager.markCompleted(gameId, '1/2-1/2', 'aborted');
      return reply.send({ success: true, message: 'Room was already closed or completed' });
    }
    room.forceTerminate();
    roomManager.markCompleted(room.gameId, '1/2-1/2', 'aborted');
    roomManager.removeRoom(room.gameId);
    return reply.send({ success: true, message: `Game ${room.gameId} terminated successfully.` });
  });

  const handleWs = (socket: WebSocket, req: any) => {
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
              const { gameId, preferredColor, timeControl } = parse.data;

              activeGameId = gameId;

              // 1. If game has already completed, immediately notify client and close
              if (roomManager.isCompleted(gameId)) {
                const info = roomManager.getCompletedInfo(gameId);
                socket.send(
                  JSON.stringify({
                    type: 'game:over',
                    payload: {
                      gameId,
                      result: info?.result || '1/2-1/2',
                      termination: info?.termination || 'abandoned',
                      completed: true,
                    },
                  })
                );
                socket.close(1000, 'GAME_ALREADY_COMPLETED');
                return;
              }

              let room = roomManager.getRoom(gameId);
              if (!room) {
                const firstPlayerIsBlack = preferredColor === 'black';
                const tc = timeControl || '5+0';
                const [baseStr, incStr] = tc.split('+');
                const baseTimeSeconds = (parseInt(baseStr, 10) || 5) * 60;
                const incrementSeconds = parseInt(incStr, 10) || 0;

                room = roomManager.getOrCreateRoom({
                  gameId,
                  white: firstPlayerIsBlack
                    ? { id: '', username: 'Waiting...', rating: 200 }
                    : { id: authenticatedUserId, username: authenticatedUsername, rating: 200 },
                  black: firstPlayerIsBlack
                    ? { id: authenticatedUserId, username: authenticatedUsername, rating: 200 }
                    : { id: '', username: 'Waiting...', rating: 200 },
                  baseTimeSeconds,
                  incrementSeconds,
                  rated: true,
                  timeControl: tc,
                });

                if (!room) {
                  socket.send(
                    JSON.stringify({
                      type: 'game:over',
                      payload: {
                        gameId,
                        result: '1/2-1/2',
                        termination: 'abandoned',
                        completed: true,
                      },
                    })
                  );
                  socket.close(1000, 'GAME_ALREADY_COMPLETED');
                  return;
                }
              } else {
                if (room.getStatus() !== 'active') {
                  socket.send(
                    JSON.stringify({
                      type: 'game:over',
                      payload: {
                        gameId,
                        result: '1/2-1/2',
                        termination: 'abandoned',
                        completed: true,
                      },
                    })
                  );
                  socket.close(1000, 'GAME_OVER');
                  return;
                }

                // If both players are seated: seats are permanently locked
                if (room.isBothSeated()) {
                  const isWhite = room.white.id === authenticatedUserId;
                  const isBlack = room.black.id === authenticatedUserId;

                  // An outsider / third party has connected with the game link
                  if (!isWhite && !isBlack) {
                    // If either player has left / closed their tab: VOID AND ABORT THE GAME
                    if (!room.isWhiteConnected() || !room.isBlackConnected()) {
                      room.finishGame('*', 'aborted');
                      roomManager.markCompleted(gameId, '*', 'aborted');
                      socket.send(
                        JSON.stringify({
                          type: 'game:over',
                          payload: {
                            gameId,
                            result: '*',
                            termination: 'aborted',
                            message: 'Game voided due to player disconnect and unauthorized entry.',
                            completed: true,
                          },
                        })
                      );
                      socket.close(1000, 'GAME_VOIDED');
                      return;
                    }
                    // Both players are connected: third party spectates only (no seating)
                  }
                } else {
                  // Only one player seated so far (waiting for opponent)
                  const hasWhite = !!room.white.id && room.white.id !== 'Waiting...' && room.white.id !== '';
                  const hasBlack = !!room.black.id && room.black.id !== 'Waiting...' && room.black.id !== '' && room.black.id !== 'opponent_placeholder';
                  const creatorConnected = (hasWhite && room.isWhiteConnected()) || (hasBlack && room.isBlackConnected());
                  const isCreatorRejoining = room.white.id === authenticatedUserId || room.black.id === authenticatedUserId;

                  if (!creatorConnected && !isCreatorRejoining) {
                    room.abortAbandonedRoom();
                    roomManager.markCompleted(gameId, '1/2-1/2', 'abandoned');
                    socket.send(
                      JSON.stringify({
                        type: 'game:over',
                        payload: {
                          gameId,
                          result: '1/2-1/2',
                          termination: 'abandoned',
                          completed: true,
                        },
                      })
                    );
                    socket.close(1000, 'GAME_ABANDONED');
                    return;
                  }

                  const isAlreadyWhite = room.white.id === authenticatedUserId;
                  const isAlreadyBlack = room.black.id === authenticatedUserId;

                  if (!isAlreadyWhite && !isAlreadyBlack) {
                    const isWhiteEmpty = !room.white.id || room.white.id === 'Waiting...' || room.white.id === '';
                    const isBlackEmpty = !room.black.id || room.black.id === 'Waiting...' || room.black.id === '' || room.black.id === 'opponent_placeholder';

                    if (preferredColor === 'white' && isWhiteEmpty) {
                      room.setWhitePlayer({
                        id: authenticatedUserId,
                        username: authenticatedUsername,
                        rating: 200,
                      });
                    } else if (preferredColor === 'black' && isBlackEmpty) {
                      room.setBlackPlayer({
                        id: authenticatedUserId,
                        username: authenticatedUsername,
                        rating: 200,
                      });
                    } else if (isWhiteEmpty) {
                      room.setWhitePlayer({
                        id: authenticatedUserId,
                        username: authenticatedUsername,
                        rating: 200,
                      });
                    } else if (isBlackEmpty) {
                      room.setBlackPlayer({
                        id: authenticatedUserId,
                        username: authenticatedUsername,
                        rating: 200,
                      });
                    }
                  }
                }
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
  };

  app.register(async (wsScope) => {
    wsScope.get('/ws/game', { websocket: true }, handleWs);
    wsScope.get('/ws', { websocket: true }, handleWs);
    wsScope.get('/', { websocket: true }, handleWs);
  });

  return app;
}

const isMainModule =
  process.env.pm_id !== undefined ||
  process.env.START_SERVER === 'true' ||
  Boolean(process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href);

if (isMainModule) {
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

