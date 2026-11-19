'use client';

import { computeBotMove } from '@schoolchess/chess-core';
import { Chess } from 'chess.js';

export interface StockfishBotMove {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
  evalScore?: number;
  evalText?: string;
  depth?: number;
  engine: 'stockfish-wasm' | 'stockfish-js' | 'stockfish-api' | 'core-fallback';
}

export interface BotLevelConfig {
  level: number;
  name: string;
  elo: number;
  desc: string;
  skillLevel: number;
  movetime: number;
}

export const BOT_LEVEL_CONFIGS: BotLevelConfig[] = [
  { level: 1, name: 'Beginner Bot', elo: 400, desc: 'Just learning the rules. Hangs pieces and falls for easy traps.', skillLevel: 0, movetime: 180 },
  { level: 2, name: 'Casual Bot', elo: 800, desc: 'Knows basic moves, but leaves pieces hanging if under pressure.', skillLevel: 1, movetime: 220 },
  { level: 3, name: 'Club Bot', elo: 1100, desc: 'Plays solid openings, snatches free pieces, and punishes blunders.', skillLevel: 3, movetime: 280 },
  { level: 4, name: 'Intermediate Bot', elo: 1500, desc: 'Sharp tactics, castles early, and coordinates pieces for real attacks.', skillLevel: 7, movetime: 350 },
  { level: 5, name: 'Advanced Bot', elo: 1800, desc: 'Aggressive and punishing. Spots multi-move tactical combinations.', skillLevel: 11, movetime: 420 },
  { level: 6, name: 'Expert Bot', elo: 2100, desc: 'Ruthless tournament strength. One slip and it suffocates your position.', skillLevel: 15, movetime: 500 },
  { level: 7, name: 'Master Bot', elo: 2500, desc: 'Grandmaster play. Absolutely zero mercy on mistakes and converts every edge.', skillLevel: 18, movetime: 600 },
  { level: 8, name: 'Max Level Stockfish', elo: 3200, desc: 'Unbeatable engine god. Calculates millions of lines to crush your soul.', skillLevel: 20, movetime: 700 },
];

class StockfishWorkerService {
  private worker: Worker | null = null;
  private isReady = false;
  private workerType: 'stockfish-wasm' | 'stockfish-js' | null = null;
  private currentResolver: ((value: StockfishBotMove) => void) | null = null;
  private currentRejecter: ((reason: any) => void) | null = null;
  private currentFen = '';
  private currentEvaluation: { score?: number; text?: string; depth?: number } = {};
  private activeTimeout: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      this.initWorker();
    }
  }

  private initWorker() {
    try {
      const wasmSupported =
        typeof WebAssembly === 'object' &&
        typeof WebAssembly.validate === 'function' &&
        WebAssembly.validate(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));

      const scriptPath = wasmSupported ? '/stockfish/stockfish.wasm.js' : '/stockfish/stockfish.js';
      this.workerType = wasmSupported ? 'stockfish-wasm' : 'stockfish-js';

      this.worker = new Worker(scriptPath);

      this.worker.onmessage = (e: MessageEvent) => {
        this.handleMessage(e.data);
      };

      this.worker.onerror = () => {
        // Fallback to JS worker if wasm failed
        if (this.workerType === 'stockfish-wasm') {
          this.workerType = 'stockfish-js';
          try {
            this.worker?.terminate();
            this.worker = new Worker('/stockfish/stockfish.js');
            this.worker.onmessage = (ev) => this.handleMessage(ev.data);
            this.worker.postMessage('uci');
            this.worker.postMessage('isready');
          } catch {}
        }
      };

      this.worker.postMessage('uci');
      this.worker.postMessage('isready');
    } catch {
      this.worker = null;
    }
  }

  private handleMessage(data: string) {
    if (typeof data !== 'string') return;

    if (data === 'uciok' || data === 'readyok') {
      this.isReady = true;
      return;
    }

    // Parse info string for evaluation score
    if (data.startsWith('info') && data.includes('score')) {
      const parts = data.split(/\s+/);
      const scoreIdx = parts.indexOf('score');
      const depthIdx = parts.indexOf('depth');

      if (depthIdx !== -1 && parts[depthIdx + 1]) {
        this.currentEvaluation.depth = parseInt(parts[depthIdx + 1], 10);
      }

      if (scoreIdx !== -1 && parts[scoreIdx + 1] && parts[scoreIdx + 2]) {
        const type = parts[scoreIdx + 1];
        const val = parseInt(parts[scoreIdx + 2], 10);
        if (type === 'cp') {
          this.currentEvaluation.score = val;
          const cp = (val / 100).toFixed(1);
          this.currentEvaluation.text = val >= 0 ? `+${cp}` : `${cp}`;
        } else if (type === 'mate') {
          this.currentEvaluation.score = val > 0 ? 30000 : -30000;
          this.currentEvaluation.text = val > 0 ? `+M${val}` : `-M${Math.abs(val)}`;
        }
      }
    }

    // Parse bestmove line
    if (data.startsWith('bestmove')) {
      if (this.activeTimeout) {
        clearTimeout(this.activeTimeout);
        this.activeTimeout = null;
      }

      const parts = data.trim().split(/\s+/);
      const bestMove = parts[1];

      if (this.currentResolver) {
        if (!bestMove || bestMove === '(none)') {
          if (this.currentRejecter) {
            this.currentRejecter(new Error('No legal move'));
          }
        } else {
          const from = bestMove.slice(0, 2);
          const to = bestMove.slice(2, 4);
          const promotion = bestMove.length > 4 ? bestMove.slice(4, 5) : undefined;

          // Compute SAN using chess.js
          let san: string | undefined;
          try {
            const chess = new Chess(this.currentFen);
            const res = chess.move({ from, to, promotion: promotion || 'q' });
            san = res?.san;
          } catch {}

          this.currentResolver({
            from,
            to,
            promotion,
            san,
            evalScore: this.currentEvaluation.score,
            evalText: this.currentEvaluation.text,
            depth: this.currentEvaluation.depth,
            engine: this.workerType || 'stockfish-wasm',
          });
        }

        this.currentResolver = null;
        this.currentRejecter = null;
      }
    }
  }

  public async getMove(fen: string, level: number): Promise<StockfishBotMove> {
    const config = BOT_LEVEL_CONFIGS.find((c) => c.level === level) || BOT_LEVEL_CONFIGS[2];
    this.currentFen = fen;
    this.currentEvaluation = {};

    // 1. Client-Side Stockfish Web Worker (zero VPS resources, sub-second latency)
    if (this.worker) {
      try {
        return await new Promise<StockfishBotMove>((resolve, reject) => {
          this.currentResolver = resolve;
          this.currentRejecter = reject;

          this.activeTimeout = setTimeout(() => {
            this.currentResolver = null;
            this.currentRejecter = null;
            reject(new Error('Stockfish worker timed out'));
          }, config.movetime + 500);

          this.worker?.postMessage('stop');
          this.worker?.postMessage('setoption name Hash value 32');
          this.worker?.postMessage(`setoption name Skill Level value ${config.skillLevel}`);
          this.worker?.postMessage(`position fen ${fen}`);
          this.worker?.postMessage(`go movetime ${config.movetime}`);
        });
      } catch {
        // Fall through to server API or core engine
      }
    }

    // 2. Server API fallback
    try {
      const res = await fetch('/api/v1/bot/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          level: config.level,
          movetime: config.movetime,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        let san: string | undefined;
        try {
          const chess = new Chess(fen);
          const m = chess.move({ from: data.from, to: data.to, promotion: data.promotion || 'q' });
          san = m?.san;
        } catch {}

        return {
          from: data.from,
          to: data.to,
          promotion: data.promotion,
          san: san || data.san,
          engine: 'stockfish-api',
        };
      }
    } catch {}

    // 3. Fallback to bundled chess-core
    const fallbackMove = computeBotMove(fen, Math.min(5, level));
    return {
      from: fallbackMove.from,
      to: fallbackMove.to,
      promotion: fallbackMove.promotion,
      san: fallbackMove.san,
      evalScore: fallbackMove.evalScore,
      engine: 'core-fallback',
    };
  }
}

export const stockfishService = new StockfishWorkerService();

