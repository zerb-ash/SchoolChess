'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Zap, Flame, Clock, Swords, Plus, KeyRound, AlertCircle, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function PlayPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeQueue, setActiveQueue] = useState<{
    timeControl: string;
    waitSeconds: number;
    ratingRange: number;
  } | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const [joiningCode, setJoiningCode] = useState(false);

  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [challengeTimeControl, setChallengeTimeControl] = useState('5+0');
  const [challengeSide, setChallengeSide] = useState<'white' | 'black' | 'random'>('random');
  const [challengeRated, setChallengeRated] = useState(true);
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const timeControls = [
    { title: '1 min', sub: 'Lightning Salon', speed: '1+0', icon: Zap, label: 'Bullet' },
    { title: '3 min', sub: 'Rapid Exchange', speed: '3+0', icon: Flame, label: 'Blitz' },
    { title: '5 min', sub: 'Master Blitz', speed: '5+0', icon: Flame, label: 'Blitz' },
    { title: '10 min', sub: 'Classical Rapid', speed: '10+0', icon: Clock, label: 'Rapid' },
  ];

  const handleJoinQueue = async (speed: string) => {
    const userId = user?.id || 'guest_' + Math.random().toString(36).substring(2, 9);
    const username = user?.username || 'Guest';

    try {
      const res = await fetch(`${API_BASE}/api/v1/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username,
          timeControl: speed,
          rating: user?.ratings?.fide || 1600,
        }),
      });

      if (!res.ok) throw new Error('Failed to join queue');

      const data = await res.json();
      if (data.status === 'matched' && data.gameId) {
        router.push(`/game/${data.gameId}`);
        return;
      }

      setActiveQueue({
        timeControl: speed,
        waitSeconds: 0,
        ratingRange: 50,
      });

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/v1/matchmaking/status?userId=${userId}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          if (statusData.status === 'matched' && statusData.gameId) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            router.push(`/game/${statusData.gameId}`);
          } else if (statusData.status === 'queued') {
            setActiveQueue({
              timeControl: statusData.timeControl,
              waitSeconds: statusData.waitSeconds,
              ratingRange: statusData.ratingRange,
            });
          }
        } catch {
          // Keep polling
        }
      }, 1500);
    } catch {
      // Offline fallback: launch sandbox / local game room
      const localGameId = 'game_' + Math.random().toString(36).substring(2, 10);
      router.push(`/game/${localGameId}`);
    }
  };

  const handleCancelQueue = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    const userId = user?.id || '';
    if (userId) {
      try {
        await fetch(`${API_BASE}/api/v1/matchmaking/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch {
        // Ignore
      }
    }
    setActiveQueue(null);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinCodeError(null);
    if (!joinCode.trim()) return;

    setJoiningCode(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/challenges/join-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Room code not found');
      }

      const data = await res.json();
      router.push(`/challenge/${data.token}`);
    } catch (err: unknown) {
      setJoinCodeError(err instanceof Error ? err.message : 'Invalid code');
      setJoiningCode(false);
    }
  };

  const handleCreateChallenge = async () => {
    setCreatingChallenge(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user?.id,
          creatorUsername: user?.username || 'Challenger',
          timeControl: challengeTimeControl,
          side: challengeSide,
          rated: challengeRated,
        }),
      });

      if (!res.ok) throw new Error('Failed to create challenge');

      const data = await res.json();
      router.push(`/challenge/${data.challenge.token}`);
    } catch {
      setCreatingChallenge(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-10">
      <div className="flex flex-col gap-2 border-b border-wood-800 pb-6">
        <div className="flex items-center gap-2 text-brass-400 text-xs uppercase tracking-widest font-mono">
          <Crown className="w-4 h-4" />
          <span>Authoritative Matchmaking</span>
        </div>
        <h1 className="text-3xl font-serif text-parchment-100">Grandmaster Salon</h1>
        <p className="text-xs text-parchment-400 max-w-xl leading-relaxed">
          Select a time control for instant pairing against peer opponents, or create an invitation-only room for friends or classmates.
        </p>
      </div>

      {activeQueue ? (
        <div className="p-8 rounded-2xl bg-wood-900 border border-brass-500/40 shadow-2xl flex flex-col items-center justify-center text-center gap-4 animate-fadeIn">
          <div className="w-14 h-14 rounded-full border-4 border-brass-500 border-t-transparent animate-spin mb-2" />
          <h2 className="text-xl font-serif text-parchment-100">Searching for Opponent</h2>
          <p className="text-xs text-parchment-400">
            Pool: <span className="font-mono font-bold text-brass-300">{activeQueue.timeControl}</span> • Time elapsed: <span className="font-mono text-parchment-200">{activeQueue.waitSeconds}s</span>
          </p>
          <div className="text-[11px] px-3 py-1 rounded-full bg-wood-950 border border-wood-800 text-parchment-400 font-mono">
            Rating Window: ±{activeQueue.ratingRange} points
          </div>
          <button
            onClick={handleCancelQueue}
            className="mt-4 px-6 py-2.5 rounded-lg bg-wood-950 hover:bg-wood-800 border border-wood-700 text-parchment-300 text-xs font-semibold transition-colors"
          >
            Cancel Matchmaking
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm uppercase tracking-wider text-parchment-400 font-medium">Quick Pairings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {timeControls.map((tc) => {
              const Icon = tc.icon;
              return (
                <button
                  key={tc.speed}
                  onClick={() => handleJoinQueue(tc.speed)}
                  className="p-5 rounded-2xl bg-wood-900 border border-wood-800 hover:border-brass-500/50 hover:bg-wood-850 flex flex-col gap-2 transition-all hover:-translate-y-0.5 shadow-lg group text-left"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-brass-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-mono font-bold text-parchment-500 group-hover:text-brass-300">
                      {tc.speed}
                    </span>
                  </div>
                  <div className="text-2xl font-serif font-bold text-parchment-100 mt-2">{tc.title}</div>
                  <div className="text-xs font-medium text-parchment-400">{tc.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="p-6 rounded-2xl bg-wood-900 border border-wood-800 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-brass-400">
              <Swords className="w-5 h-5" />
              <h3 className="font-serif text-lg text-parchment-100">Private Challenge</h3>
            </div>
            <p className="text-xs text-parchment-400 leading-relaxed">
              Create a custom match with shareable link and a 6-digit room code for direct play.
            </p>
          </div>
          <button
            onClick={() => setChallengeModalOpen(true)}
            className="w-full py-3 rounded-xl bg-brass-600 hover:bg-brass-500 text-wood-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invitation</span>
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-wood-900 border border-wood-800 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-brass-400">
              <KeyRound className="w-5 h-5" />
              <h3 className="font-serif text-lg text-parchment-100">Join by Room Code</h3>
            </div>
            <p className="text-xs text-parchment-400 leading-relaxed">
              Have a 6-character room code from a classmate or instructor? Enter it below.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="flex flex-col gap-2">
            {joinCodeError && (
              <div className="text-xs text-salon-crimson flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{joinCodeError}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. K9W42B"
                className="flex-1 px-3 py-2.5 rounded-lg bg-wood-950 border border-wood-700 focus:border-brass-400 focus:outline-none text-sm font-mono tracking-widest text-parchment-100 uppercase"
              />
              <button
                type="submit"
                disabled={joiningCode || !joinCode.trim()}
                className="px-5 py-2.5 rounded-lg bg-wood-850 hover:bg-wood-800 text-parchment-200 border border-wood-700 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                <span>Join</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {challengeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-wood-900 border border-brass-500/30 p-6 shadow-2xl text-parchment-100">
            <div className="flex items-center justify-between pb-4 border-b border-wood-800 mb-4">
              <h3 className="font-serif text-lg text-parchment-100">Configure Challenge</h3>
              <button
                onClick={() => setChallengeModalOpen(false)}
                className="p-1 text-parchment-400 hover:text-parchment-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-parchment-300 uppercase tracking-wider mb-2">
                  Time Control
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['1+0', '3+0', '5+0', '10+0'].map((tc) => (
                    <button
                      key={tc}
                      type="button"
                      onClick={() => setChallengeTimeControl(tc)}
                      className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-all ${
                        challengeTimeControl === tc
                          ? 'bg-brass-600 text-wood-950 border-brass-500'
                          : 'bg-wood-950 text-parchment-300 border-wood-800 hover:border-wood-700'
                      }`}
                    >
                      {tc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-parchment-300 uppercase tracking-wider mb-2">
                  Piece Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['random', 'white', 'black'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setChallengeSide(side)}
                      className={`py-2 text-xs font-semibold capitalize rounded-lg border transition-all ${
                        challengeSide === side
                          ? 'bg-brass-600 text-wood-950 border-brass-500'
                          : 'bg-wood-950 text-parchment-300 border-wood-800 hover:border-wood-700'
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-wood-950 border border-wood-800">
                <span className="text-xs text-parchment-300">Rated Game (Multi-System)</span>
                <input
                  type="checkbox"
                  checked={challengeRated}
                  onChange={(e) => setChallengeRated(e.target.checked)}
                  className="w-4 h-4 accent-brass-500 rounded"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCreateChallenge}
                  disabled={creatingChallenge}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 text-wood-950 font-bold text-xs uppercase tracking-wider transition-all hover:scale-[1.01] shadow-lg shadow-brass-700/20"
                >
                  {creatingChallenge ? 'Generating Room...' : 'Create Room & Get Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
