'use client';

import React, { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Chess } from 'chess.js';
import { Chessboard } from '../../../components/board/Chessboard';
import { CapturedPieces } from '../../../components/board/CapturedPieces';
import { computeCapturedPieces } from '../../../lib/chessCaptured';
import { getClientPlayerId, getClientPlayerUsername } from '../../../lib/guestPlayer';
import { useAppSettings } from '../../../lib/useSettings';
import { useAuth } from '../../../lib/useAuth';
import { soundSystem } from '../../../lib/audio';
import { getWsBaseUrl, getApiBaseUrl } from '../../../lib/config';
import { TabSocketManager } from '@schoolchess/tab-sync';
import { Clock, ShieldCheck, Flag, Handshake, Trophy, ArrowUpDown, User, Eye, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Check, X } from 'lucide-react';
import { OwnerBadge, isOwner } from '../../../components/ui/OwnerBadge';

const API_BASE = getApiBaseUrl();

function getCategoryFromTimeControl(tc?: string): 'bullet' | 'blitz' | 'rapid' | 'classical' {
  if (!tc) return 'blitz';
  const baseMinutes = parseInt(tc.split('+')[0], 10) || 5;
  if (baseMinutes <= 2) return 'bullet';
  if (baseMinutes <= 5) return 'blitz';
  if (baseMinutes <= 30) return 'rapid';
  return 'classical';
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTermination(termination?: string): string {
  switch (termination?.toLowerCase()) {
    case 'checkmate':
      return 'Checkmate';
    case 'resignation':
      return 'Resignation';
    case 'timeout':
      return 'Timeout';
    case 'stalemate':
      return 'Stalemate';
    case 'draw_agreement':
      return 'Mutual Agreement';
    case 'repetition':
      return '3-fold Repetition';
    case 'insufficient_material':
      return 'Insufficient Material';
    case 'fifty_moves':
      return '50-Move Rule';
    case 'aborted':
    case 'abandoned':
      return 'Match Aborted';
    default:
      return termination ? termination.charAt(0).toUpperCase() + termination.slice(1) : 'Game Ended';
  }
}

function LiveGameContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = (params?.id as string) || 'default-room';
  const colorParam = searchParams?.get('color') as 'white' | 'black' | null;

  const { themeColors, settings } = useAppSettings();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const urlPlayerId = searchParams?.get('playerId');
  const [clientSessionId] = useState(() => {
    return urlPlayerId || getClientPlayerId(user?.id);
  });

  const effectiveUserId = user ? user.id : urlPlayerId || clientSessionId;
  const effectiveUsername = user
    ? user.username
    : getClientPlayerUsername(undefined, colorParam);

  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(() => chess.fen());
  const [orientation, setOrientation] = useState<'white' | 'black'>(() => (colorParam === 'black' ? 'black' : 'white'));
  const [myColor, setMyColor] = useState<'w' | 'b' | null>(() => (colorParam === 'black' ? 'b' : colorParam === 'white' ? 'w' : null));
  const [players, setPlayers] = useState<{
    white?: { id: string; username: string; rating?: number };
    black?: { id: string; username: string; rating?: number };
  }>({});
  const [gameTimeControl, setGameTimeControl] = useState<string>(searchParams?.get('timeControl') || '5+0');
  const [opponentRatings, setOpponentRatings] = useState<Record<string, number>>({});

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
  const [gameOverData, setGameOverData] = useState<{
    result: string;
    termination: string;
    winnerId?: string;
    completed?: boolean;
    rated?: boolean;
    ratingUpdates?: {
      white?: { fide?: number; chess_com?: number; lichess?: number };
      black?: { fide?: number; chess_com?: number; lichess?: number };
    };
  } | null>(null);
  const matchStartTimeRef = useRef<number>(Date.now());
  const [matchDurationSeconds, setMatchDurationSeconds] = useState<number>(0);
  const startingRatingRef = useRef<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawOfferedByOpponent, setDrawOfferedByOpponent] = useState(false);
  const [drawOfferNotice, setDrawOfferNotice] = useState<string | null>(null);
  const [tabRole, setTabRole] = useState<'leader' | 'candidate'>('candidate');
  const [pendingConfirmMove, setPendingConfirmMove] = useState<{
    from: string;
    to: string;
    promotion?: 'q' | 'r' | 'b' | 'n';
    san?: string;
    piece?: string;
  } | null>(null);

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
        if ((state as any).timeControl) {
          setGameTimeControl((state as any).timeControl);
        }

        const isWhite =
          state.white &&
          (state.white.id === effectiveUserId ||
            (effectiveUsername && state.white.username.toLowerCase() === effectiveUsername.toLowerCase()));

        const isBlack =
          state.black &&
          (state.black.id === effectiveUserId ||
            (effectiveUsername && state.black.username.toLowerCase() === effectiveUsername.toLowerCase()));

        if (isWhite && isBlack) {
          // Same account opened in two tabs for testing
          if (colorParam === 'black') {
            setMyColor('b');
            setOrientation('black');
          } else {
            setMyColor('w');
            setOrientation('white');
          }
        } else if (isWhite && !isBlack) {
          setMyColor('w');
          setOrientation('white');
        } else if (isBlack && !isWhite) {
          setMyColor('b');
          setOrientation(settings.autoFlipWhenBlack !== false ? 'black' : 'white');
        } else if (colorParam === 'black') {
          setMyColor('b');
          setOrientation('black');
        } else if (colorParam === 'white') {
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
        setGameOverData((prev) => ({
          ...prev,
          ...data,
          ratingUpdates: data.ratingUpdates || prev?.ratingUpdates,
        }));
        soundSystem.playGameOver();
        setRedirectCountdown((prev) => (prev !== null ? prev : 10));

        if (matchStartTimeRef.current) {
          const duration = Math.max(1, Math.floor((Date.now() - matchStartTimeRef.current) / 1000));
          setMatchDurationSeconds(duration);
        }

        setTimeout(() => {
          refreshUser();
        }, 1000);
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
    const activeCat = getCategoryFromTimeControl(timeControlParam || gameTimeControl);
    const myRating = user?.ratings?.byCategory?.[activeCat]?.fide ?? user?.ratings?.fide ?? 200;
    manager.joinGame(gameId, colorParam || undefined, timeControlParam, myRating);

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

  // Auto-navigate to /play 10 seconds after match concludes
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      router.push('/play');
      return;
    }
    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          router.push('/play');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [redirectCountdown, router]);

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

  const executeConfirmedMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
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

  const handleMakeMove = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (isGameOver) return;
    if (myColor && myColor !== turn) {
      if (settings.enablePremoves) {
        setPremove({ from, to, promotion: promotion || 'q' });
      }
      return;
    }

    if (settings.confirmMove) {
      let san = `${from} → ${to}`;
      let pieceType = '';
      try {
        const piece = chess.get(from as any);
        if (piece) {
          const names: Record<string, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
          pieceType = names[piece.type] || piece.type.toUpperCase();
        }
        const tempChess = new Chess(chess.fen());
        const moveRes = tempChess.move({ from, to, promotion: promotion || 'q' });
        if (moveRes) san = moveRes.san;
      } catch {}

      setPendingConfirmMove({ from, to, promotion, san, piece: pieceType });
      return;
    }

    executeConfirmedMove(from, to, promotion);
  };

  useEffect(() => {
    if (!pendingConfirmMove) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeConfirmedMove(pendingConfirmMove.from, pendingConfirmMove.to, pendingConfirmMove.promotion);
        setPendingConfirmMove(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPendingConfirmMove(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingConfirmMove]);

  useEffect(() => {
    if (isGameOver && pendingConfirmMove) {
      setPendingConfirmMove(null);
    }
  }, [isGameOver, pendingConfirmMove]);

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

  const activeCategory = getCategoryFromTimeControl(gameTimeControl);
  const myFideModeRating =
    user?.ratings?.byCategory?.[activeCategory]?.fide ??
    user?.ratings?.fide ??
    200;

  useEffect(() => {
    if (myFideModeRating > 0 && startingRatingRef.current === null) {
      startingRatingRef.current = myFideModeRating;
    }
  }, [myFideModeRating]);

  useEffect(() => {
    if (isGameOver && matchDurationSeconds === 0 && matchStartTimeRef.current) {
      const duration = Math.max(1, Math.floor((Date.now() - matchStartTimeRef.current) / 1000));
      setMatchDurationSeconds(duration);
    }
  }, [isGameOver, matchDurationSeconds]);

  useEffect(() => {
    const opp = isTopMe ? bottomPlayer : isBottomMe ? topPlayer : null;
    if (
      opp &&
      opp.username &&
      !opp.username.startsWith('Guest') &&
      !opp.id?.startsWith('guest_') &&
      !opp.id?.startsWith('anon_') &&
      opp.username !== 'Waiting...'
    ) {
      if (!opponentRatings[opp.username]) {
        fetch(`${API_BASE}/api/v1/users/${opp.username}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.ratings?.[activeCategory]) {
              setOpponentRatings((prev) => ({ ...prev, [opp.username]: d.ratings[activeCategory] }));
            } else if (d?.byCategory?.[activeCategory]?.fide) {
              setOpponentRatings((prev) => ({ ...prev, [opp.username]: d.byCategory[activeCategory].fide }));
            }
          })
          .catch(() => {});
      }
    }
  }, [players.white?.username, players.black?.username, isTopMe, isBottomMe, activeCategory, opponentRatings]);

  const formatPlayerDisplay = (player?: { id: string; username: string; rating?: number }, isMe = false) => {
    if (isMe) {
      const myRating = (player?.rating && player.rating > 0 ? player.rating : undefined) ?? myFideModeRating;
      return `You (${myRating})`;
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

    const oppRating =
      opponentRatings[player.username] ??
      (player.rating && player.rating > 0 ? player.rating : undefined) ??
      200;
    return `${player.username} (${oppRating})`;
  };

  const topPlayerLabel = formatPlayerDisplay(topPlayer, isTopMe);
  const bottomPlayerLabel = formatPlayerDisplay(bottomPlayer, isBottomMe);

  const isWhiteWinner = gameOverData?.result === '1-0';
  const isBlackWinner = gameOverData?.result === '0-1';
  const isDraw =
    gameOverData?.result === '1/2-1/2' ||
    gameOverData?.termination === 'stalemate' ||
    gameOverData?.termination === 'draw_agreement' ||
    gameOverData?.termination === 'repetition' ||
    gameOverData?.termination === 'insufficient_material' ||
    gameOverData?.termination === 'fifty_moves';
  const isAborted =
    gameOverData?.result === '*' ||
    gameOverData?.termination === 'aborted' ||
    gameOverData?.termination === 'abandoned';

  const isMyWin = (myColor === 'w' && isWhiteWinner) || (myColor === 'b' && isBlackWinner);
  const isMyLoss = (myColor === 'w' && isBlackWinner) || (myColor === 'b' && isWhiteWinner);

  const displayOldElo = startingRatingRef.current || myFideModeRating || 200;
  let displayNewElo = displayOldElo;
  if (myColor === 'w' && gameOverData?.ratingUpdates?.white?.fide) {
    displayNewElo = gameOverData.ratingUpdates.white.fide;
  } else if (myColor === 'b' && gameOverData?.ratingUpdates?.black?.fide) {
    displayNewElo = gameOverData.ratingUpdates.black.fide;
  } else if (user?.ratings?.byCategory?.[activeCategory]?.fide && user.ratings.byCategory[activeCategory].fide !== displayOldElo) {
    displayNewElo = user.ratings.byCategory[activeCategory].fide;
  }
  const displayDelta = displayNewElo - displayOldElo;

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

  const { whiteCaptured, blackCaptured, whiteAdvantage, blackAdvantage } = useMemo(() => {
    return computeCapturedPieces(fen);
  }, [fen]);

  const { displayFen, displayLastMove } = useMemo(() => {
    if (!pendingConfirmMove) {
      return { displayFen: fen, displayLastMove: lastMove };
    }
    try {
      const tempChess = new Chess(fen);
      tempChess.move({
        from: pendingConfirmMove.from,
        to: pendingConfirmMove.to,
        promotion: pendingConfirmMove.promotion || 'q',
      });
      return {
        displayFen: tempChess.fen(),
        displayLastMove: { from: pendingConfirmMove.from, to: pendingConfirmMove.to },
      };
    } catch {
      return { displayFen: fen, displayLastMove: lastMove };
    }
  }, [fen, lastMove, pendingConfirmMove]);

  const isMyTurn = myColor !== null && myColor === turn;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 sm:gap-6 lg:gap-8 py-3 sm:py-6 px-2 sm:px-4">
      <div className="flex flex-col items-center w-full max-w-[min(100vw-16px,calc(100vh-220px))] sm:max-w-[540px] md:max-w-[620px]">
        {opponentReconnectSec !== null && !isGameOver && (
          <div className="w-full mb-3 p-3 rounded-xl bg-amber-950/80 border border-amber-600/50 text-amber-200 text-xs flex items-center justify-between shadow-lg animate-pulse">
            <span className="font-semibold">Opponent disconnected. Awaiting reconnection...</span>
            <span className="font-mono font-bold text-amber-300">{opponentReconnectSec}s</span>
          </div>
        )}

        {/* Top Player (Opponent) */}
        <div className="w-full flex items-center justify-between mb-1.5 sm:mb-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                topColor === 'black' ? 'bg-wood-950 border border-brass-500/40' : 'bg-parchment-100 shadow'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-300 flex items-center gap-1">
              <span>{topPlayerLabel}</span>
              {isOwner(topPlayer?.username) && <OwnerBadge size="xs" />}
            </span>
            <CapturedPieces
              captured={topColor === 'white' ? whiteCaptured : blackCaptured}
              advantage={topColor === 'white' ? whiteAdvantage : blackAdvantage}
            />
            {turn === (topColor === 'white' ? 'w' : 'b') && !isGameOver && (
              <span className="w-2 h-2 rounded-full bg-brass-400 animate-ping" />
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wood-900 border border-wood-800 text-xs font-mono font-bold text-parchment-200 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-brass-400" />
            <span>{formatClock(topClockMs)}</span>
          </div>
        </div>

        {/* Board Container */}
        <div className="relative w-full aspect-square">
          <Chessboard
            fen={displayFen}
            orientation={orientation}
            themeColors={themeColors}
            showCoordinates={settings.showCoordinates}
            highlightLastMove={settings.highlightLastMove}
            highlightLegalMoves={settings.highlightLegalMoves && !pendingConfirmMove}
            lastMove={displayLastMove}
            premove={premove}
            isCheck={isCheck}
            turn={turn}
            myColor={myColor || undefined}
            autoQueen={settings.autoQueenPromotion}
            onMakeMove={handleMakeMove}
            onCancelPremove={() => setPremove(null)}
            getLegalMovesForSquare={getLegalMovesForSquare}
            disabled={isGameOver || (!isMyTurn && !settings.enablePremoves) || !!pendingConfirmMove}
          />

          {/* On-Board Modern Move Confirmation Modal */}
          {pendingConfirmMove && !isGameOver && (
            <div className="absolute inset-0 z-30 rounded-2xl bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn">
              <div className="relative bg-wood-950/90 border border-brass-500/50 backdrop-blur-xl rounded-2xl px-5 py-4 sm:px-6 sm:py-5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(197,168,88,0.15)] flex flex-col items-center gap-3.5 max-w-[280px] sm:max-w-[320px] w-full text-center border-t-brass-400/60 animate-in zoom-in-95 duration-150">
                <span className="text-[10px] uppercase font-mono tracking-widest text-brass-400 font-bold">
                  Confirm Move
                </span>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm sm:text-base font-serif font-bold text-parchment-100 flex items-center gap-1.5 flex-wrap justify-center">
                    <span>{pendingConfirmMove.piece || 'Piece'}</span>
                    <span className="text-parchment-400 font-normal">from</span>
                    <span className="font-mono font-bold text-brass-300 px-1.5 py-0.5 rounded bg-wood-900 border border-wood-700/80 text-xs sm:text-sm">
                      {pendingConfirmMove.from.toUpperCase()}
                    </span>
                    <span className="text-parchment-400 font-normal">to</span>
                    <span className="font-mono font-bold text-brass-300 px-1.5 py-0.5 rounded bg-wood-900 border border-wood-700/80 text-xs sm:text-sm">
                      {pendingConfirmMove.to.toUpperCase()}
                    </span>
                  </span>
                  {pendingConfirmMove.san && (
                    <span className="text-xs font-mono text-parchment-300">
                      Notation: <strong className="text-parchment-100">{pendingConfirmMove.san}</strong>
                      {pendingConfirmMove.promotion && ` (= ${pendingConfirmMove.promotion.toUpperCase()})`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full mt-0.5">
                  <button
                    onClick={() => setPendingConfirmMove(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-wood-900 hover:bg-wood-850 active:scale-95 text-parchment-300 hover:text-parchment-100 border border-wood-700/80 font-serif text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <X className="w-3.5 h-3.5 text-parchment-400" />
                    <span>Cancel</span>
                  </button>

                  <button
                    onClick={() => {
                      executeConfirmedMove(pendingConfirmMove.from, pendingConfirmMove.to, pendingConfirmMove.promotion);
                      setPendingConfirmMove(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-brass-600 hover:bg-brass-500 active:scale-95 text-wood-950 font-serif text-xs font-bold transition-all shadow-[0_0_15px_rgba(197,168,88,0.3)] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Confirm</span>
                  </button>
                </div>

                <span className="text-[10px] text-parchment-500 font-mono">
                  Enter ↵ to confirm • Esc to cancel
                </span>
              </div>
            </div>
          )}

          {/* On-Board Modern Match End Modal */}
          {isGameOver && (
            <div className="absolute inset-0 z-30 rounded-2xl bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn">
              <div className="relative bg-wood-950/95 border border-brass-500/50 backdrop-blur-xl rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(197,168,88,0.2)] flex flex-col items-center gap-3.5 max-w-[310px] sm:max-w-[350px] w-full text-center border-t-brass-400/80 animate-in zoom-in-95 duration-150">
                {/* Header Tag */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-wood-900 border border-brass-500/30">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-brass-400 font-bold">
                    Match Has Ended
                  </span>
                </div>

                {/* Outcome Heading */}
                <div className="flex flex-col items-center gap-1">
                  {isAborted ? (
                    <>
                      <div className="text-xl sm:text-2xl font-serif font-bold text-parchment-200 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <span>Match Aborted</span>
                      </div>
                      <span className="text-xs text-parchment-400">Game ended before completion</span>
                    </>
                  ) : isDraw ? (
                    <>
                      <div className="text-xl sm:text-2xl font-serif font-bold text-parchment-100 flex items-center gap-2">
                        <Handshake className="w-5 h-5 text-brass-300" />
                        <span>Draw</span>
                      </div>
                      <span className="text-xs text-parchment-400">
                        by {formatTermination(gameOverData?.termination || 'draw')}
                      </span>
                    </>
                  ) : isMyWin ? (
                    <>
                      <div className="text-xl sm:text-2xl font-serif font-bold text-brass-300 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-brass-400" />
                        <span>Victory!</span>
                      </div>
                      <span className="text-xs text-parchment-400">
                        by {formatTermination(gameOverData?.termination || 'resignation')}
                      </span>
                    </>
                  ) : isMyLoss ? (
                    <>
                      <div className="text-xl sm:text-2xl font-serif font-bold text-rose-400 flex items-center gap-2">
                        <Flag className="w-5 h-5 text-rose-400" />
                        <span>Defeat</span>
                      </div>
                      <span className="text-xs text-parchment-400">
                        by {formatTermination(gameOverData?.termination || 'resignation')}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-xl sm:text-2xl font-serif font-bold text-parchment-100">
                        {isWhiteWinner ? 'White Wins' : isBlackWinner ? 'Black Wins' : 'Game Over'}
                      </div>
                      <span className="text-xs text-parchment-400">
                        by {formatTermination(gameOverData?.termination || 'game over')}
                      </span>
                    </>
                  )}
                </div>

                {/* Total Moves & Duration */}
                <div className="grid grid-cols-2 gap-2 w-full mt-0.5">
                  <div className="bg-wood-900/90 border border-wood-800 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-parchment-400">
                      Total Moves
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-parchment-100 mt-0.5">
                      {Math.ceil(moveHistory.length / 2)}{' '}
                      <span className="text-[10px] text-parchment-400 font-sans font-normal">
                        ({moveHistory.length} ply)
                      </span>
                    </span>
                  </div>

                  <div className="bg-wood-900/90 border border-wood-800 rounded-xl p-2.5 flex flex-col items-center">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-parchment-400">
                      Duration
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-parchment-100 mt-0.5">
                      {formatDuration(matchDurationSeconds)}
                    </span>
                  </div>
                </div>

                {/* Rating Change Card */}
                <div className="w-full bg-wood-900/90 border border-brass-500/30 rounded-xl p-2.5 flex flex-col items-center gap-1 shadow-inner">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-parchment-400">
                    Rating Change ({activeCategory.toUpperCase()})
                  </span>
                  <div className="flex items-center gap-2 font-mono font-bold text-sm sm:text-base">
                    <span className="text-parchment-300">{displayOldElo}</span>
                    <span
                      className={
                        displayDelta > 0
                          ? 'text-emerald-400'
                          : displayDelta < 0
                          ? 'text-rose-400'
                          : 'text-parchment-400'
                      }
                    >
                      {displayDelta >= 0 ? `+ ${displayDelta}` : `- ${Math.abs(displayDelta)}`}
                    </span>
                    <span className="text-brass-400 font-sans">→</span>
                    <span className="text-brass-300 text-base sm:text-lg">{displayNewElo}</span>
                  </div>
                  {(!gameOverData?.rated || isAborted) && (
                    <span className="text-[10px] text-parchment-500 font-mono">
                      (Unrated or Aborted)
                    </span>
                  )}
                </div>

                {/* Back to Lobby Button */}
                <button
                  onClick={() => router.push('/play')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 active:scale-95 text-wood-950 font-serif font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(197,168,88,0.3)] flex items-center justify-center gap-2 cursor-pointer mt-0.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Back to Lobby</span>
                </button>

                {/* Countdown Indicator */}
                {redirectCountdown !== null && (
                  <span className="text-[10px] text-parchment-400 font-mono">
                    Returning to lobby in <strong className="text-brass-400">{redirectCountdown}</strong>s...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Player (You) */}
        <div className="w-full flex items-center justify-between mt-1.5 sm:mt-2 px-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                bottomColor === 'white' ? 'bg-parchment-100 shadow' : 'bg-wood-950 border border-brass-500/40'
              }`}
            />
            <span className="text-xs font-serif font-bold text-parchment-100 flex items-center gap-1">
              <span>{bottomPlayerLabel}</span>
              {(isOwner(bottomPlayer?.username) || (isBottomMe && isOwner(user?.username))) && <OwnerBadge size="xs" />}
            </span>
            <CapturedPieces
              captured={bottomColor === 'white' ? whiteCaptured : blackCaptured}
              advantage={bottomColor === 'white' ? whiteAdvantage : blackAdvantage}
            />
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


      </div>

      {/* Right Column: Move History & In-game controls */}
      <div className="w-full max-w-[min(100vw-16px,calc(100vh-220px))] sm:max-w-[540px] md:max-w-[620px] lg:max-w-none lg:w-80 flex flex-col gap-4">
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
