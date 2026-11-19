import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { computeBotMove } from '@schoolchess/chess-core';
import { Chess } from 'chess.js';

const BotMoveSchema = z.object({
  fen: z.string().min(1),
  level: z.number().int().min(1).max(20).default(3),
  movetime: z.number().int().min(50).max(900).default(400),
});

// Concurrency gate to ensure the VPS never spikes > 2 concurrent engine searches
let activeSearches = 0;
const MAX_CONCURRENT_SEARCHES = 2;

function queryStockfishBinary(
  fen: string,
  skillLevel: number,
  movetime: number
): Promise<{ from: string; to: string; promotion?: string; bestMove: string }> {
  return new Promise((resolve, reject) => {
    let sf;
    try {
      sf = spawn('stockfish');
    } catch (err) {
      return reject(err);
    }

    let stdoutData = '';
    const timeout = setTimeout(() => {
      try {
        sf.stdin.write('quit\n');
        sf.kill('SIGTERM');
      } catch {}
      reject(new Error('Stockfish process timeout'));
    }, movetime + 1500);

    sf.stdout.on('data', (data) => {
      stdoutData += data.toString();
      const lines = stdoutData.split('\n');
      for (const line of lines) {
        if (line.startsWith('bestmove')) {
          clearTimeout(timeout);
          try {
            sf.stdin.write('quit\n');
            sf.kill('SIGTERM');
          } catch {}

          const parts = line.trim().split(/\s+/);
          const bestMove = parts[1];
          if (!bestMove || bestMove === '(none)') {
            return reject(new Error('No legal move found by Stockfish'));
          }

          const from = bestMove.slice(0, 2);
          const to = bestMove.slice(2, 4);
          const promotion = bestMove.length > 4 ? bestMove.slice(4, 5) : undefined;
          return resolve({ from, to, promotion, bestMove });
        }
      }
    });

    sf.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    sf.stdin.write('uci\n');
    sf.stdin.write(`setoption name Skill Level value ${skillLevel}\n`);
    sf.stdin.write('setoption name Threads value 1\n');
    sf.stdin.write('setoption name Hash value 16\n');
    sf.stdin.write(`position fen ${fen}\n`);
    sf.stdin.write(`go movetime ${movetime}\n`);
  });
}

export async function botRoutes(app: FastifyInstance) {
  app.post('/api/v1/bot/move', async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = BotMoveSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ message: 'Invalid move request', errors: parse.error.format() });
    }

    const { fen, level, movetime } = parse.data;

    // Check FEN validity
    try {
      new Chess(fen);
    } catch {
      return reply.code(400).send({ message: 'Invalid FEN string' });
    }

    // Map 1-8 difficulty level to Stockfish Skill Level (0 to 20)
    let sfSkillLevel = 3;
    if (level === 1) sfSkillLevel = 0;
    else if (level === 2) sfSkillLevel = 1;
    else if (level === 3) sfSkillLevel = 3;
    else if (level === 4) sfSkillLevel = 7;
    else if (level === 5) sfSkillLevel = 11;
    else if (level === 6) sfSkillLevel = 15;
    else if (level === 7) sfSkillLevel = 18;
    else if (level >= 8) sfSkillLevel = 20;

    // Concurrency control: if too many server requests, immediately use lightweight fallback
    if (activeSearches < MAX_CONCURRENT_SEARCHES) {
      activeSearches++;
      try {
        const move = await queryStockfishBinary(fen, sfSkillLevel, movetime);
        activeSearches--;
        return reply.send({
          ...move,
          source: 'stockfish',
          skillLevel: sfSkillLevel,
        });
      } catch (err) {
        activeSearches--;
        // Fallback to core engine on error
      }
    }

    // Fallback if stockfish binary is unavailable or busy
    try {
      const coreMove = computeBotMove(fen, Math.min(5, level));
      return reply.send({
        from: coreMove.from,
        to: coreMove.to,
        promotion: coreMove.promotion,
        bestMove: `${coreMove.from}${coreMove.to}${coreMove.promotion || ''}`,
        san: coreMove.san,
        source: 'chess-core-fallback',
      });
    } catch (e: any) {
      return reply.code(500).send({ message: 'Failed to compute bot move', error: e?.message });
    }
  });
}

