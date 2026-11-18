'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Chess } from 'chess.js';
import { Chessboard } from '../../../components/board/Chessboard';
import { useAppSettings } from '../../../lib/useSettings';
import { useAuth } from '../../../lib/useAuth';
import { soundSystem } from '../../../lib/audio';
import { getWsBaseUrl } from '../../../lib/config';
import { TabSocketManager } from '@schoolchess/tab-sync';
import { Clock, ShieldCheck, Flag, Handshake, Trophy, ArrowUpDown, User, Eye, AlertTriangle } from 'lucide-react';

function LiveGameContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = (params?.id as string) || 'default-room';
  const colorParam = searchParams?.get('color') as 'white' | 'black' | null;

  const { themeColors, settings } = useAppSettings();
  const { user, loading: authLoading } = useAuth();

  const [clientSessionId] = useState(() => {
    if (typeof window === 'undefined') return 'guest_' + Math.random().toString(36).substring(2, 8);
    const colorHint = colorParam ? `_${colorParam}` : '';
    return 'guest' + colorHint + '_' + Math.random().toString(36).substring(2, 8);
  });

  const effectiveUserId = user ? user.id : clientSessionId;
  const effectiveUsername = user
    ? user.username
    : colorParam
    ? `Guest (${colorParam === 'white' ? 'White' : 'Black'})`
    : `Guest ${clientSessionId.substring(clientSessionId.length - 4)}`;

  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>(() => (colorParam === 'black' ? 'black' : 'white'));
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(() => (colorParam === 'black' ? 'b' : colorParam === 'white' ? 'w' : null));
  const [players, setPlayers] = useState<{
    white?: { id: string; username: string };
    black?: { id: string; username: string };
  }>({});

  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | null>(null);
  const premoveRef = useRef<{ from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | null>(null);
  premoveRef.current = premove;

  const [moveNumber, setMoveNumber] = useState(0);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [awaySecondsRemaining, setAwaySecondsRemaining] = useState<number | null>(null);
  const awayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [opponentReconnectSec, setOpponentReconnectSec] = useState<number | null>(null);
  const [whiteClockMs, setWhiteClockMs] = useState(300000);
  const [blackClockMs, setBlackClockMs] = useState(300000);
  const [isConnected, setIsConnected] = useState(false);
  const [gameOverData, setGameOverData] = useState<{ result: string; termination: string; winnerId?: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawOfferedByOpponent, setDrawOfferedByOpponent] = useState(false);
  const [drawOfferNotice, setDrawOfferNotice] = useState<string | null>(null);
  const [tabRole, setTabRole] = useState<'leader' | 'candidate'>('candidate');

  const tabSocketRef = useRef<TabSocketManager | null>(null);
  const moveNumberRef = useRef(0);
  moveNumberRef.current = moveNumber;

  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isGameOver = !!gameOverData || chess.isGameOver();

  useEffect(() => {
    if (authLoading) return;

    const baseWsUrl = getWsBaseUrl();
    const wsUrl = `${baseWsUrl}?userId=${encodeURIComponent(effectiveUserId)}&username=${encodeURIComponent(effectiveUsername)}`;

    const manager = new TabSocketManager({
      wsUrl,
      userId: effectiveUserId,
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

        if (state.history && Array.isArray(state.history)) {
          setMoveHistory(state.history);
        }

        setPlayers({ white: state.white, black: state.black });

        const isWhite =
          state.white &&
          (state.white.id === effectiveUserId ||
            (effectiveUsername && state.white.username.toLowerCase() === effectiveUsername.toLowerCase()));

        const isBlack =
          state.black &&
          (state.black.id === effectiveUserId ||
            (effectiveUsername && state.black.username.toLowerCase() === effectiveUsername.toLowerCase()));

        if (colorParam === 'white') {
          setMyColor('w');
          setOrientation('white');
        } else if (colorParam === 'black') {
          setMyColor('b');
          setOrientation('black');
        } else if (isWhite && !isBlack) {
          setMyColor('w');
          setOrientation('white');
        } else if (isBlack && !isWhite) {
          setMyColor('b');
          setOrientation(settings.autoFlipWhenBlack ? 'black' : 'white');
        } else if (isWhite && isBlack) {
          setMyColor('w');
          setOrientation('white');
        }
      },
      onMoveApplied: (event) => {
        try {
          chess.move({
            from: event.move.from,
            to: event.move.to,
            promotion: event.move.promotion || 'q',
          });
        } catch {
          chess.load(event.fen);
        }
        setFen(event.fen);
        setLastMove({ from: event.move.from, to: event.move.to });
        setMoveNumber(event.moveNumber);
        setWhiteClockMs(event.whiteClockMs);
        setBlackClockMs(event.blackClockMs);
        setDrawOfferedByOpponent(false);

        setMoveHistory((prev) => {
          const next = [...prev];
          next[event.moveNumber - 1] = event.move.san;
          return next;
        });

        soundSystem.playMoveEvent({
          check: event.isCheck,
          promotion: !!event.move.promotion,
          captured: event.move.san.includes('x'),
        });

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
      onDrawOffered: (data) => {
        if (myColor && data.fromColor !== myColor) {
          setDrawOfferedByOpponent(true);
        }
      },
      onDrawDeclined: () => {
        setDrawOfferedByOpponent(false);
        setDrawOfferNotice('Draw offer was declined.');
        setTimeout(() => setDrawOfferNotice(null), 3000);
      },
      onPresenceChange: (presence) => {
        const isOpponentConn = myColor === 'w' ? presence.blackConnected : myColor === 'b' ? presence.whiteConnected : true;
        setOpponentConnected(isOpponentConn);
        if (!isOpponentConn && moveNumberRef.current > 0) {
          setOpponentReconnectSec((prev) => (prev !== null ? prev : 60));
        } else {
          setOpponentReconnectSec(null);
        }
      },
    });

    tabSocketRef.current = manager;
    const timeControlParam = searchParams.get('timeControl') || undefined;
    manager.joinGame(gameId, colorParam || undefined, timeControlParam);

    return () => {
      manager.disconnect();
    };
  }, [gameId, effectiveUserId, effectiveUsername, authLoading, chess, myColor, colorParam, searchParams, settings.autoFlipWhenBlack]);

  useEffect(() => {
    if (opponentReconnectSec === null || opponentReconnectSec <= 0) return;
    const timer = setInterval(() => {
      setOpponentReconnectSec((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [opponentReconnectSec]);

  // Local clock countdown for the active turn (only when both seated and active)
  useEffect(() => {
    const isGameActive =
      !isGameOver &&
      isConnected &&
      !!players.white?.id &&
      !!players.black?.id &&
      players.black?.id !== 'Waiting...' &&
      players.black?.id !== '';

    if (!isGameActive) return;

    const interval = setInterval(() => {
      if (turn === 'w') {
        setWhiteClockMs((prev) => Math.max(0, prev - 100));
      } else {
        setBlackClockMs((prev) => Math.max(0, prev - 100));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [turn, isGameOver, isConnected, players.white?.id, players.black?.id]);

  const formatClock = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  function getGeometricPremoveMoves(pieceType: string, pieceColor: 'w' | 'b', fromSq: string): string[] {
    const f = fromSq.charCodeAt(0) - 97;
    const r = parseInt(fromSq[1], 10);
    const type = pieceType.toUpperCase();
    const isWhite = pieceColor === 'w';
    const targets: string[] = [];

    const add = (cf: number, cr: number) => {
      if (cf >= 0 && cf < 8 && cr >= 1 && cr <= 8) {
        targets.push(`${String.fromCharCode(97 + cf)}${cr}`);
      }
    };

    if (type === 'P') {
      const dir = isWhite ? 1 : -1;
      add(f, r + dir);
      if ((isWhite && r === 2) || (!isWhite && r === 7)) {
        add(f, r + 2 * dir);
      }
      add(f - 1, r + dir);
      add(f + 1, r + dir);
    } else if (type === 'N') {
      const deltas = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [df, dr] of deltas) add(f + df, r + dr);
    } else if (type === 'K') {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (df !== 0 || dr !== 0) add(f + df, r + dr);
        }
      }
      add(f + 2, r);
      add(f - 2, r);
    } else if (type === 'B') {
      for (let d = 1; d < 8; d++) {
        add(f + d, r + d);
        add(f + d, r - d);
        add(f - d, r + d);
        add(f - d, r - d);
      }
    } else if (type === 'R') {
      for (let d = 1; d < 8; d++) {
        add(f + d, r);
        add(f - d, r);
        add(f, r + d);
        add(f, r - d);
      }
    } else if (type === 'Q') {
      for (let d = 1; d < 8; d++) {
        add(f + d, r + d);
        add(f + d, r - d);
        add(f - d, r + d);
        add(f - d, r - d);
        add(f + d, r);
        add(f - d, r);
        add(f, r + d);
        add(f, r - d);
      }
    }
    return targets;
  }

  const getLegalMovesForSquare = (square: string): string[] => {
    if (isGameOver) return [];
    if (myColor && myColor !== turn) {
      if (settings.enablePremoves) {
        try {
          const piece = chess.get(square as any);
          if (piece && piece.color === myColor) {
            return getGeometricPremoveMoves(piece.type, piece.color, square);
          }
        } catch {}
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
        setPremove({ from, to, promotion: promotion || 'q' });
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
      setDrawOfferNotice('Draw offer sent to opponent.');
      setTimeout(() => setDrawOfferNotice(null), 3000);
    }
  };

  const handleAcceptDraw = () => {
    if (tabSocketRef.current) {
      tabSocketRef.current.sendDrawAction({ gameId, action: 'accept' });
      setDrawOfferedByOpponent(false);
    }
  };

  const handleDeclineDraw = () => {
    if (tabSocketRef.current) {
      tabSocketRef.current.sendDrawAction({ gameId, action: 'decline' });
      setDrawOfferedByOpponent(false);
    }
  };

  // Physical abandonment timer: if player is away from page for 60s during active match, auto-abort
  useEffect(() => {
    const isGameActive =
      !isGameOver &&
      isConnected &&
      !!players.white?.id &&
      !!players.black?.id &&
      players.black?.id !== 'Waiting...' &&
      myColor !== null;

    if (!isGameActive) {
      if (awayTimerRef.current) clearInterval(awayTimerRef.current);
      setAwaySecondsRemaining(null);
      return;
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        let count = 60;
        setAwaySecondsRemaining(count);
        if (awayTimerRef.current) clearInterval(awayTimerRef.current);
        awayTimerRef.current = setInterval(() => {
          count -= 1;
          setAwaySecondsRemaining(count);
          if (count <= 0) {
            if (awayTimerRef.current) clearInterval(awayTimerRef.current);
            // Player physically left tab for over 60s: auto-resign/abort
            tabSocketRef.current?.sendResign({ gameId });
          }
        }, 1000);
      } else {
        if (awayTimerRef.current) {
          clearInterval(awayTimerRef.current);
          awayTimerRef.current = null;
        }
        setAwaySecondsRemaining(null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (awayTimerRef.current) clearInterval(awayTimerRef.current);
    };
  }, [isGameOver, isConnected, players.white?.id, players.black?.id, myColor, gameId]);

  const topColor = orientation === 'white' ? 'black' : 'white';
  const bottomColor = orientation === 'white' ? 'white' : 'black';

  const topPlayer = topColor === 'white' ? players.white : players.black;
  const bottomPlayer = bottomColor === 'white' ? players.white : players.black;

  const isTopMe = myColor !== null && myColor === (topColor === 'white' ? 'w' : 'b');
  const isBottomMe = myColor !== null && myColor === (bottomColor === 'white' ? 'w' : 'b');
  const isSpectator = myColor === null;

  const formatPlayerDisplay = (player?: { id: string; username: string; rating?: number }, isMe = false) => {
    if (isMe) {
      const myRating = player?.rating && player.rating > 0 ? ` (${player.rating})` : user?.ratings?.fide ? ` (${user.ratings.fide})` : user ? ' (200)' : '';
      return `You${myRating}`;
    }

    if (
      !player ||
      !player.id ||
      player.id.startsWith('guest_') ||
      player.id.startsWith('anon_') ||
      player.username === 'Waiting...' ||
      player.username.startsWith('Guest')
    ) {
      return 'Opponent';
    }

    const ratingStr = player.rating && player.rating > 0 ? ` (${player.rating})` : '';
    return `${player.username}${ratingStr}`;
  };

  const topPlayerLabel = formatPlayerDisplay(topPlayer, isTopMe);
  const bottomPlayerLabel = formatPlayerDisplay(bottomPlayer, isBottomMe);

  // Sync active match state to localStorage for multi-tab dock
  useEffect(() => {
    if (isGameOver) {
      localStorage.removeItem('schoolchess_active_match');
      return;
    }

    const isRealMatch =
      !!myColor &&
      !!players.white?.id &&
      !!players.black?.id &&
      players.black.id !== 'Waiting...' &&
      players.white.id !== players.black.id;

    if (isRealMatch) {
      localStorage.setItem(
        'schoolchess_active_match',
        JSON.stringify({
          gameId,
          whiteClockMs,
          blackClockMs,
          whiteLabel: topColor === 'white' ? topPlayerLabel : bottomPlayerLabel,
          blackLabel: topColor === 'black' ? topPlayerLabel : bottomPlayerLabel,
          turn,
          isGameOver,
          awaySecondsRemaining,
          updatedAt: Date.now(),
        })
      );
    } else {
      localStorage.removeItem('schoolchess_active_match');
    }
  }, [gameId, whiteClockMs, blackClockMs, topPlayerLabel, bottomPlayerLabel, turn, isGameOver, myColor, awaySecondsRemaining, topColor, players.white?.id, players.black?.id]);

  const topClockMs = topColor === 'white' ? whiteClockMs : blackClockMs;
  const bottomClockMs = bottomColor === 'white' ? whiteClockMs : blackClockMs;

  const isMyTurn = myColor !== null && myColor === turn;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-6 px-4">
      <div className="flex flex-col items-center w-full max-w-[620px]">
        {opponentReconnectSec !== null && !isGameOver && (
          <div className="w-full mb-3 p-3 rounded-xl bg-amber-950/80 border border-amber-600/50 text-amber-200 text-xs flex items-center justify-between shadow-lg animate-pulse">
            <span className="font-semibold">Opponent disconnected. Awaiting reconnection...</span>
            <span className="font-mono font-bold text-amber-300">{opponentReconnectSec}s</span>
          </div>
        )}

        {/* Top Player (Opponent) */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                topColor === 'black' ? 'bg-wood-950 border border-brass-500/40' : 'bg-parchment-100 shadow'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-300">
              {topPlayerLabel}
            </span>
            {turn === (topColor === 'white' ? 'w' : 'b') && !isGameOver && (
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
          myColor={myColor || undefined}
          autoQueen={settings.autoQueenPromotion}
          onMakeMove={handleMakeMove}
          onCancelPremove={() => setPremove(null)}
          getLegalMovesForSquare={getLegalMovesForSquare}
          disabled={isGameOver || (!isMyTurn && !settings.enablePremoves)}
        />

        {/* Bottom Player (You) */}
        <div className="w-full flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                bottomColor === 'white' ? 'bg-parchment-100 shadow' : 'bg-wood-950 border border-brass-500/40'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-100">
              {bottomPlayerLabel}
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

        {/* Draw Offer Banner from Opponent */}
        {drawOfferedByOpponent && !isGameOver && (
          <div className="w-full mt-3 p-3.5 rounded-xl bg-wood-900 border border-brass-500/60 shadow-xl flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-serif font-bold text-parchment-100">
              <Handshake className="w-4 h-4 text-brass-400" />
              <span>Opponent offered a draw. Accept?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAcceptDraw}
                className="px-3.5 py-1.5 bg-brass-600 hover:bg-brass-500 text-wood-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={handleDeclineDraw}
                className="px-3.5 py-1.5 bg-wood-950 hover:bg-wood-850 text-parchment-300 text-xs rounded-lg border border-wood-700 transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Draw Offer Notice */}
        {drawOfferNotice && (
          <div className="w-full mt-2 p-2 rounded-lg bg-wood-950/80 border border-wood-800 text-center text-xs text-brass-300 animate-fadeIn">
            {drawOfferNotice}
          </div>
        )}

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
            {isSpectator ? (
              <>
                <Eye className="w-3 h-3 text-brass-400" />
                <span>Spectating</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3 text-brass-400" />
                <span>{isMyTurn ? 'Your Turn' : "Opponent's Turn"}</span>
              </>
            )}
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
        {isSpectator ? (
          <div className="p-3 bg-wood-900 border border-wood-800 rounded-xl text-center text-xs text-parchment-400 font-serif flex items-center justify-center gap-2 shadow-inner">
            <Eye className="w-4 h-4 text-brass-400" />
            <span>Spectator Mode • Real-time server sync</span>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default function LiveGamePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-parchment-400">Loading game room...</div>}>
      <LiveGameContent />
    </Suspense>
  );
}
