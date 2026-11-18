'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Clock, Swords, ArrowRight, AlertTriangle, X } from 'lucide-react';

interface ActiveMatchData {
  gameId: string;
  whiteClockMs: number;
  blackClockMs: number;
  whiteLabel: string;
  blackLabel: string;
  turn: 'w' | 'b';
  isGameOver: boolean;
  awaySecondsRemaining?: number | null;
  updatedAt: number;
}

const STORAGE_KEY = 'schoolchess_active_match';

export function ActiveGameDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [match, setMatch] = useState<ActiveMatchData | null>(null);
  const [dismissedGameId, setDismissedGameId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const checkMatch = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setMatch(null);
          return;
        }
        const parsed: ActiveMatchData = JSON.parse(raw);
        // Expire matches older than 2 hours or finished
        if (parsed.isGameOver || Date.now() - parsed.updatedAt > 2 * 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEY);
          setMatch(null);
          return;
        }
        setMatch(parsed);
      } catch {
        setMatch(null);
      }
    };

    checkMatch();
    const interval = setInterval(checkMatch, 1000);
    const liveTicker = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) checkMatch();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      clearInterval(liveTicker);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (!match) return null;

  // Don't show dock if already on that game page
  if (pathname === `/game/${match.gameId}` || pathname.startsWith(`/game/${match.gameId}?`)) {
    return null;
  }

  // Allow user to dismiss for this gameId
  if (dismissedGameId === match.gameId) {
    return null;
  }

  const elapsedMs = Math.max(0, Date.now() - match.updatedAt);
  const liveWhiteMs = match.turn === 'w' && !match.isGameOver
    ? Math.max(0, match.whiteClockMs - elapsedMs)
    : match.whiteClockMs;
  const liveBlackMs = match.turn === 'b' && !match.isGameOver
    ? Math.max(0, match.blackClockMs - elapsedMs)
    : match.blackClockMs;

  const liveAwaySeconds =
    typeof match.awaySecondsRemaining === 'number' && match.awaySecondsRemaining > 0
      ? Math.max(0, Math.ceil(match.awaySecondsRemaining - elapsedMs / 1000))
      : null;

  const formatClock = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fadeIn select-none">
      <div className="bg-wood-900 border border-brass-500/50 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2.5 max-w-xs text-parchment-100 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-wood-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-serif font-bold tracking-wide uppercase text-brass-400 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" />
              <span>Active Match</span>
            </span>
          </div>

          <button
            onClick={() => setDismissedGameId(match.gameId)}
            className="text-parchment-500 hover:text-parchment-300 transition-colors p-0.5 rounded cursor-pointer"
            title="Dismiss widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timers Row */}
        <div className="flex items-center justify-between gap-3 text-xs font-mono font-bold bg-wood-950 p-2 rounded-xl border border-wood-850">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-parchment-100 shadow" />
            <span className={match.turn === 'w' ? 'text-brass-400 font-bold' : 'text-parchment-300'}>
              {formatClock(liveWhiteMs)}
            </span>
          </div>

          <span className="text-parchment-600 font-normal">vs</span>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-wood-900 border border-brass-500/40" />
            <span className={match.turn === 'b' ? 'text-brass-400 font-bold' : 'text-parchment-300'}>
              {formatClock(liveBlackMs)}
            </span>
          </div>
        </div>

        {/* Away Auto-Abort Warning */}
        {liveAwaySeconds !== null && liveAwaySeconds > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-salon-crimson/20 border border-salon-crimson/40 text-[10px] text-red-300 font-mono">
            <AlertTriangle className="w-3 h-3 text-salon-crimson shrink-0 animate-bounce" />
            <span>Abandonment in {liveAwaySeconds}s</span>
          </div>
        )}

        {/* Back to Game Button */}
        <button
          onClick={() => router.push(`/game/${match.gameId}`)}
          className="w-full py-2 px-3 rounded-xl bg-brass-600 hover:bg-brass-500 text-wood-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer"
        >
          <span>Back to Game</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

