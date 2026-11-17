'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Chess } from 'chess.js';
import { Chessboard } from '../../../components/board/Chessboard';
import { useAppSettings } from '../../../lib/useSettings';
import { useAuth } from '../../../lib/useAuth';
import { soundSystem } from '../../../lib/audio';
import { TabSocketManager } from '@schoolchess/tab-sync';
import { Clock, ShieldCheck, Flag, Handshake, Trophy, ArrowUpDown, User } from 'lucide-react';

export default function LiveGamePage() {
  const params = useParams();
  const gameId = (params?.id as string) || 'default-room';

  const { themeColors, settings } = useAppSettings();
  const { user, loading: authLoading } = useAuth();

  const [clientSessionId] = useState(() => {
    if (typeof window === 'undefined') return 'guest_' + Math.random().toString(36).substring(2, 8);
    let id = sessionStorage.getItem('schoolchess_game_client_id');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem('schoolchess_game_client_id', id);
    }
    return id;
  });

  const effectiveUserId = user ? user.id : clientSessionId;
  const effectiveUsername = user ? user.username : 'Guest ' + clientSessionId.substring(6, 10);

  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(null);
  const [players, setPlayers] = useState<{
    white?: { id: string; username: string };
    black?: { id: string; username: string };
  }>({});

  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | null>(null);
  const premoveRef = useRef<{ from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | null>(null);
  premoveRef.current = premove;

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
    if (authLoading) return;

    const baseWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001/ws/game';
    const wsUrl = `${baseWsUrl}?userId=${encodeURIComponent(effectiveUserId)}&username=${encodeURIComponent(effectiveUsername)}`;

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

        setPlayers({ white: state.white, black: state.black });

        const isWhite =
          state.white &&
          (state.white.id === effectiveUserId ||
            (effectiveUsername && state.white.username.toLowerCase() === effectiveUsername.toLowerCase()));

        const isBlack =
          state.black &&
          (state.black.id === effectiveUserId ||
            (effectiveUsername && state.black.username.toLowerCase() === effectiveUsername.toLowerCase()));

        if (isWhite) {
          setMyColor('w');
          setOrientation('white');
        } else if (isBlack) {
          setMyColor('b');
          setOrientation(settings.autoFlipWhenBlack ? 'black' : 'white');
        }
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

        // Trigger queued premove if it is now this player's turn
        const nextTurn = chess.turn();
        const activePremove = premoveRef.current;
        if (activePremove && myColor && myColor === nextTurn) {
          setPremove(null);
          try {
            const isLegal = chess.moves({ square: activePremove.from as any, verbose: true }).some(
              (m) => m.to === activePremove.to
            );
            if (isLegal) {
              manager.sendMove({
                gameId,
                from: activePremove.from,
                to: activePremove.to,
                promotion: activePremove.promotion,
                expectedMoveNumber: event.moveNumber,
                idempotencyKey: `${gameId}_${event.moveNumber}_${activePremove.from}_${activePremove.to}_${Date.now()}`,
              });
            }
          } catch {
            // Ignore illegal premove
          }
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
    manager.joinGame(gameId);

    return () => {
      manager.disconnect();
    };
  }, [gameId, effectiveUserId, effectiveUsername, authLoading, chess, myColor, settings.autoFlipWhenBlack]);

  // Local clock countdown for the active turn
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
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getLegalMovesForSquare = (square: string): string[] => {
    if (isGameOver) return [];
    if (myColor && myColor !== turn) {
      if (settings.enablePremoves) {
        return chess.moves({ square: square as any, verbose: true }).map((m) => m.to);
      }
      return [];
    }
    const moves = chess.moves({ square: square as any, verbose: true });
    return moves.map((m) => m.to);
  };

  const handleMakeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (isGameOver) return;
    if (myColor && myColor !== turn) {
      if (settings.enablePremoves) {
        setPremove({ from, to, promotion });
      }
      return;
    }

    if (tabSocketRef.current) {
      tabSocketRef.current.sendMove({
        gameId,
        from,
        to,
        promotion,
        expectedMoveNumber: moveNumberRef.current,
        idempotencyKey: `${gameId}_${moveNumberRef.current}_${from}_${to}_${Date.now()}`,
      });
    }
  };

  const handleResign = () => {
    if (!confirmResign) {
      setConfirmResign(true);
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

  const topPlayerLabel =
    orientation === 'white'
      ? `${players.black?.username || 'Guest'} - Black`
      : `${players.white?.username || 'Guest'} - White`;

  const bottomPlayerLabel =
    orientation === 'white'
      ? `${players.white?.username || effectiveUsername} - White`
      : `${players.black?.username || effectiveUsername} - Black`;

  const topClockMs = orientation === 'white' ? blackClockMs : whiteClockMs;
  const bottomClockMs = orientation === 'white' ? whiteClockMs : blackClockMs;

  const isMyTurn = myColor !== null && myColor === turn;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-6 px-4">
      <div className="flex flex-col items-center w-full max-w-[620px]">
        {/* Top Player (Opponent) */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                orientation === 'white' ? 'bg-wood-950 border border-brass-500/40' : 'bg-parchment-100 shadow'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-300">
              {topPlayerLabel}
            </span>
            {((orientation === 'white' && turn === 'b') || (orientation === 'black' && turn === 'w')) && (
              <span className="w-2 h-2 rounded-full bg-brass-400 animate-ping" />
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wood-900 border border-wood-800 text-xs font-mono font-bold text-parchment-200 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-brass-400" />
            <span>{formatClock(topClockMs)}</span>
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
          premove={premove}
          isCheck={isCheck}
          turn={turn}
          autoQueen={settings.autoQueenPromotion}
          onMakeMove={handleMakeMove}
          getLegalMovesForSquare={getLegalMovesForSquare}
          disabled={isGameOver || (!isMyTurn && !settings.enablePremoves)}
        />

        {/* Bottom Player (You) */}
        <div className="w-full flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                orientation === 'white' ? 'bg-parchment-100 shadow' : 'bg-wood-950 border border-brass-500/40'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-100">
              {bottomPlayerLabel} (You)
            </span>
            {isMyTurn && !isGameOver && (
              <span className="w-2 h-2 rounded-full bg-brass-400 animate-ping" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wood-900 border border-wood-800 text-xs font-mono font-bold text-parchment-100 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-brass-400" />
              <span>{formatClock(bottomClockMs)}</span>
            </div>
            <button
              onClick={() => setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
              className="p-1.5 bg-wood-900 hover:bg-wood-850 text-parchment-300 rounded-lg border border-wood-800 text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title="Flip Board"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Game Over Banner */}
        {gameOverData && (
          <div className="w-full mt-4 p-4 rounded-xl bg-wood-900 border border-brass-500/40 text-center flex items-center justify-center gap-3 animate-fadeIn shadow-2xl">
            <Trophy className="w-5 h-5 text-brass-400" />
            <span className="font-serif font-bold text-parchment-100 text-sm">
              Game Over: {gameOverData.result} ({gameOverData.termination})
            </span>
          </div>
        )}
      </div>

      {/* Right Column: Move History & In-game controls */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <div className="bg-wood-900 border border-wood-800 rounded-xl p-3 shadow-md flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-brass-400 animate-pulse' : 'bg-salon-crimson'
              }`}
            />
            <span className="text-parchment-300 font-medium">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-wood-950 border border-wood-800 text-[10px] text-parchment-400 font-mono">
            <ShieldCheck className="w-3 h-3 text-brass-400" />
            <span>{isMyTurn ? 'Your Turn' : "Opponent's Turn"}</span>
          </div>
        </div>

        {/* Move History */}
        <div className="bg-wood-900 border border-wood-800 rounded-xl p-4 shadow-xl flex flex-col h-[300px]">
          <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-400 mb-2">
            Move History ({Math.ceil(moveHistory.length / 2)})
          </h3>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-mono text-xs">
            {moveHistory.length === 0 ? (
              <p className="text-parchment-500 italic text-center py-10">Moves will appear here...</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-wood-950 text-parchment-300">
                      <span className="text-parchment-500 w-4 text-right">{i + 1}.</span>
                      <span className="text-parchment-100 font-semibold">{moveHistory[i * 2]}</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-wood-950 text-parchment-300">
                      {moveHistory[i * 2 + 1] ? (
                        <span className="text-parchment-100 font-semibold">{moveHistory[i * 2 + 1]}</span>
                      ) : (
                        <span className="text-parchment-500">...</span>
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
            className="py-2.5 px-2 bg-wood-900 hover:bg-wood-850 text-parchment-300 rounded-xl border border-wood-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Handshake className="w-4 h-4 text-brass-500" />
            <span>Offer Draw</span>
          </button>

          <button
            onClick={handleResign}
            disabled={isGameOver || !isConnected}
            className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer ${
              confirmResign
                ? 'bg-salon-crimson/30 border-salon-crimson text-red-200 animate-pulse'
                : 'bg-wood-900 hover:bg-wood-850 text-parchment-300 border-wood-800'
            }`}
          >
            <Flag className="w-4 h-4 text-salon-crimson" />
            <span>{confirmResign ? 'Confirm?' : 'Resign'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
