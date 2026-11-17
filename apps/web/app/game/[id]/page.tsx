'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Chess } from 'chess.js';
import { Chessboard } from '../../../components/board/Chessboard';
import { useAppSettings } from '../../../lib/useSettings';
import { soundSystem } from '../../../lib/audio';
import { TabSocketManager } from '@schoolchess/tab-sync';
import { Clock, ShieldCheck, Flag, Handshake, Trophy, ArrowUpDown } from 'lucide-react';

export default function LiveGamePage() {
  const params = useParams();
  const gameId = (params?.id as string) || 'default-room';

  const { themeColors, settings } = useAppSettings();
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [moveNumber, setMoveNumber] = useState(0);
  const [whiteClockMs, setWhiteClockMs] = useState(300000);
  const [blackClockMs, setBlackClockMs] = useState(300000);
  const [isConnected, setIsConnected] = useState(false);
  const [gameOverData, setGameOverData] = useState<{ result: string; termination: string; winnerId?: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [tabRole, setTabRole] = useState<'leader' | 'candidate'>('candidate');

  const tabSocketRef = useRef<TabSocketManager | null>(null);
  const moveNumberRef = useRef(0);
  moveNumberRef.current = moveNumber;

  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isGameOver = !!gameOverData || chess.isGameOver();

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001/ws/game';

    const manager = new TabSocketManager({
      wsUrl,
      onConnectionChange: (connected) => {
        setIsConnected(connected);
      },
      onRoleChange: (role) => {
        setTabRole(role);
      },
      onStateUpdate: (state) => {
        chess.load(state.fen);
        setFen(state.fen);
        setMoveNumber(state.moveNumber);
        setWhiteClockMs(state.whiteClockMs);
        setBlackClockMs(state.blackClockMs);
      },
      onMoveApplied: (event) => {
        chess.load(event.fen);
        setFen(event.fen);
        setLastMove({ from: event.move.from, to: event.move.to });
        setMoveNumber(event.moveNumber);
        setWhiteClockMs(event.whiteClockMs);
        setBlackClockMs(event.blackClockMs);

        if (event.isCheck) {
          soundSystem.playCheck();
        } else if (event.move.san.includes('x')) {
          soundSystem.playCapture();
        } else {
          soundSystem.playMove();
        }
      },
      onMoveRejected: (err) => {
        chess.load(err.currentFen);
        setFen(err.currentFen);
        setMoveNumber(err.expectedMoveNumber);
      },
      onGameOver: (data) => {
        setGameOverData(data);
        soundSystem.playGameOver();
      },
    });

    tabSocketRef.current = manager;
    manager.subscribeGame(gameId);

    return () => {
      manager.destroy();
    };
  }, [gameId]);

  // Smooth local clock countdown interpolation
  useEffect(() => {
    if (isGameOver || !isConnected) return;

    const interval = setInterval(() => {
      if (turn === 'w') {
        setWhiteClockMs((prev) => Math.max(0, prev - 100));
      } else {
        setBlackClockMs((prev) => Math.max(0, prev - 100));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [turn, isGameOver, isConnected]);

  const formatClock = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLegalMovesForSquare = (square: string): string[] => {
    if (isGameOver) return [];
    try {
      const moves = chess.moves({ square: square as any, verbose: true });
      return moves.map((m) => m.to);
    } catch {
      return [];
    }
  };

  const handleMakeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (isGameOver || !tabSocketRef.current) return;

    tabSocketRef.current.sendMove({
      gameId,
      from,
      to,
      promotion,
      expectedMoveNumber: moveNumberRef.current,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleResign = () => {
    if (!confirmResign) {
      setConfirmResign(true);
      setTimeout(() => setConfirmResign(false), 3000);
      return;
    }

    if (tabSocketRef.current) {
      tabSocketRef.current.sendResign({ gameId });
    }
    setConfirmResign(false);
  };

  const handleDrawOffer = () => {
    if (tabSocketRef.current) {
      tabSocketRef.current.sendDrawAction({ gameId, action: 'offer' });
    }
  };

  const moveHistory = useMemo(() => chess.history(), [fen]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-6 px-4">
      {/* Board Left Column */}
      <div className="flex flex-col items-center w-full max-w-[620px]">
        {/* Top Player (Opponent) */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                orientation === 'white' ? 'bg-zinc-800 border border-zinc-600' : 'bg-white'
              }`}
            />
            <span className="text-xs font-bold text-zinc-300">
              {orientation === 'white' ? 'Opponent (Black)' : 'You (White)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-200">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{formatClock(orientation === 'white' ? blackClockMs : whiteClockMs)}</span>
          </div>
        </div>

        {/* Board */}
        <Chessboard
          fen={fen}
          orientation={orientation}
          themeColors={themeColors}
          showCoordinates={settings.showCoordinates}
          highlightLastMove={settings.highlightLastMove}
          highlightLegalMoves={settings.highlightLegalMoves}
          lastMove={lastMove}
          isCheck={isCheck}
          turn={turn}
          onMakeMove={handleMakeMove}
          getLegalMovesForSquare={getLegalMovesForSquare}
          disabled={isGameOver}
        />

        {/* Bottom Player (You) */}
        <div className="w-full flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                orientation === 'white' ? 'bg-white' : 'bg-zinc-800 border border-zinc-600'
              }`}
            />
            <span className="text-xs font-bold text-zinc-300">
              {orientation === 'white' ? 'You (White)' : 'Opponent (Black)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-200">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{formatClock(orientation === 'white' ? whiteClockMs : blackClockMs)}</span>
            </div>
            <button
              onClick={() => setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 text-xs flex items-center gap-1"
              title="Flip Board"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Game Over Banner */}
        {gameOverData && (
          <div className="w-full mt-4 p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-center flex items-center justify-center gap-3 animate-fade-in shadow-xl">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-emerald-200 text-sm">
              Game Over: {gameOverData.result} ({gameOverData.termination})
            </span>
          </div>
        )}
      </div>

      {/* Right Column: Move History & Multi-tab Status */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Connection Status Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-zinc-300 font-semibold">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 font-mono">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Tab: {tabRole}</span>
          </div>
        </div>

        {/* Move History */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl flex flex-col h-[300px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Move History ({Math.ceil(moveHistory.length / 2)})
          </h3>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-xs">
            {moveHistory.length === 0 ? (
              <p className="text-zinc-600 italic text-center py-10">Moves will appear here...</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center gap-2 p-1 rounded bg-zinc-800/40">
                      <span className="text-zinc-500 w-4 text-right">{i + 1}.</span>
                      <span className="text-zinc-200 font-semibold">{moveHistory[i * 2]}</span>
                    </div>
                    <div className="flex items-center gap-2 p-1 rounded bg-zinc-800/40">
                      {moveHistory[i * 2 + 1] ? (
                        <span className="text-zinc-200 font-semibold">{moveHistory[i * 2 + 1]}</span>
                      ) : (
                        <span className="text-zinc-600">...</span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* In-Game Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDrawOffer}
            disabled={isGameOver || !isConnected}
            className="py-2.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
          >
            <Handshake className="w-4 h-4 text-zinc-400" />
            <span>Offer Draw</span>
          </button>

          <button
            onClick={handleResign}
            disabled={isGameOver || !isConnected}
            className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
              confirmResign
                ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            }`}
          >
            <Flag className="w-4 h-4 text-zinc-400" />
            <span>{confirmResign ? 'Confirm?' : 'Resign'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

