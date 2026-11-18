'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Swords,
  Plus,
  KeyRound,
  AlertCircle,
  ArrowRight,
  X,
  Bot,
  SlidersHorizontal,
  Dices,
} from 'lucide-react';
import { BulletIcon, BlitzIcon, RapidIcon, ClassicalIcon } from '../../components/icons/ChessModeIcons';
import { useAuth } from '../../lib/useAuth';
import { AuthModal } from '../../components/auth/AuthModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CategoryFilter = 'all' | 'bullet' | 'blitz' | 'rapid' | 'classical';

export default function PlayPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [authRequiredModalOpen, setAuthRequiredModalOpen] = useState(false);

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

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

  const categories = [
    { id: 'all', label: 'All Modes' },
    { id: 'bullet', label: 'Bullet' },
    { id: 'blitz', label: 'Blitz' },
    { id: 'rapid', label: 'Rapid' },
    { id: 'classical', label: 'Classical' },
  ] as const;

  const timeControls = [
    { title: '1 min', sub: 'Bullet', speed: '1+0', category: 'bullet', icon: BulletIcon },
    { title: '1 | 1', sub: 'Bullet', speed: '1+1', category: 'bullet', icon: BulletIcon },
    { title: '2 | 1', sub: 'Bullet', speed: '2+1', category: 'bullet', icon: BulletIcon },
    { title: '3 min', sub: 'Blitz', speed: '3+0', category: 'blitz', icon: BlitzIcon },
    { title: '3 | 2', sub: 'Blitz', speed: '3+2', category: 'blitz', icon: BlitzIcon },
    { title: '5 min', sub: 'Blitz', speed: '5+0', category: 'blitz', icon: BlitzIcon },
    { title: '5 | 3', sub: 'Blitz', speed: '5+3', category: 'blitz', icon: BlitzIcon },
    { title: '10 min', sub: 'Rapid', speed: '10+0', category: 'rapid', icon: RapidIcon },
    { title: '15 | 10', sub: 'Rapid', speed: '15+10', category: 'rapid', icon: RapidIcon },
    { title: '30 min', sub: 'Rapid', speed: '30+0', category: 'rapid', icon: RapidIcon },
    { title: '30 | 20', sub: 'Classical', speed: '30+20', category: 'classical', icon: ClassicalIcon },
    { title: '60 min', sub: 'Classical', speed: '60+0', category: 'classical', icon: ClassicalIcon },
  ];

  const filteredControls =
    activeCategory === 'all'
      ? timeControls
      : timeControls.filter((tc) => tc.category === activeCategory);

  const handleJoinQueue = async (speed: string) => {
    if (!user) {
      setAuthRequiredModalOpen(true);
      return;
    }

    const userId = user.id;
    const username = user.username;

    try {
      const res = await fetch(`${API_BASE}/api/v1/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username,
          timeControl: speed,
          rating: user?.ratings?.fide || 200,
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
            router.push(`/game/${statusData.gameId}?color=${statusData.color || 'white'}`);
          } else if (statusData.status === 'queued') {
            setActiveQueue({
              timeControl: statusData.timeControl,
              waitSeconds: statusData.waitSeconds,
              ratingRange: statusData.ratingRange,
            });
          }
        } catch {
          // Continue polling
        }
      }, 1500);
    } catch (err: any) {
      console.error('Queue join error:', err);
      setActiveQueue(null);
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
        throw new Error(data.message || 'Room code not found or expired');
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
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`created_challenge_${data.challenge.token}`, 'true');
        sessionStorage.setItem(`challenge_creator_id_${data.challenge.token}`, data.challenge.creatorId);
      }
      router.push(`/challenge/${data.challenge.token}`);
    } catch {
      setCreatingChallenge(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wood-800 pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-serif font-bold text-parchment-100">Play</h1>
          <p className="text-xs text-parchment-400 max-w-xl leading-relaxed">
            Quick pairings with rating matching, bot practice, or custom private rooms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChallengeModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-wood-900 hover:bg-wood-850 border border-brass-500/30 text-parchment-200 text-xs font-semibold flex items-center gap-2 transition-all shadow cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-brass-400" />
            <span>Custom Game</span>
          </button>
        </div>
      </div>

      {/* Matchmaking Queue Active Banner */}
      {activeQueue ? (
        <div className="p-8 rounded-2xl bg-wood-900 border border-brass-500/40 shadow-2xl flex flex-col items-center justify-center text-center gap-4 animate-fadeIn">
          <div className="w-14 h-14 rounded-full border-4 border-brass-500 border-t-transparent animate-spin mb-2" />
          <h2 className="text-xl font-serif text-parchment-100">Finding Opponent</h2>
          <p className="text-xs text-parchment-400">
            {activeQueue.timeControl} • Waiting: <span className="font-mono text-parchment-200">{activeQueue.waitSeconds}s</span>
          </p>
          <div className="text-[11px] px-3 py-1 rounded-full bg-wood-950 border border-wood-800 text-parchment-400 font-mono">
            Rating Tolerance: ±{activeQueue.ratingRange}
          </div>
          <button
            onClick={handleCancelQueue}
            className="mt-4 px-6 py-2.5 rounded-lg bg-wood-950 hover:bg-wood-800 border border-wood-700 text-parchment-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel Queue
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Category Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs uppercase tracking-wider text-parchment-400 font-bold">
              Time Controls
            </h2>
            <div className="flex items-center gap-1 bg-wood-900 p-1 rounded-xl border border-wood-800">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-wood-800 text-brass-300 font-semibold shadow-sm'
                      : 'text-parchment-400 hover:text-parchment-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Controls Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {filteredControls.map((tc) => {
              const Icon = tc.icon;
              return (
                <button
                  key={tc.speed}
                  onClick={() => handleJoinQueue(tc.speed)}
                  className="p-4 rounded-xl bg-wood-900 border border-wood-800 hover:border-brass-500/50 hover:bg-wood-850 flex flex-col justify-between gap-3 transition-all hover:-translate-y-0.5 shadow-md group text-left cursor-pointer min-h-[110px]"
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon className="w-5 h-5 group-hover:scale-110 transition-transform drop-shadow" />
                    <span className="text-[11px] font-mono font-bold text-parchment-500 group-hover:text-brass-300">
                      {tc.speed}
                    </span>
                  </div>
                  <div>
                    <div className="text-xl font-serif font-bold text-parchment-100 group-hover:text-parchment-50 transition-colors">
                      {tc.title}
                    </div>
                    <div className="text-[11px] font-medium text-parchment-400">
                      {tc.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Join Room Code Section */}
      <div className="p-6 rounded-2xl bg-wood-900 border border-wood-800 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-wood-950 border border-brass-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <KeyRound className="w-5 h-5 text-brass-400" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-parchment-100">Join by Room Code</h3>
            <p className="text-xs text-parchment-400">
              Enter an opponent's 6-character room code to join their game directly.
            </p>
          </div>
        </div>

        <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {joinCodeError && (
            <div className="text-xs text-salon-crimson flex items-center gap-1.5 bg-red-950/40 px-3 py-2 rounded-xl border border-red-900/40">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{joinCodeError}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="E.G. K9W42B"
              className="w-48 h-11 px-4 rounded-xl bg-wood-950 border border-wood-700 focus:border-brass-500 focus:ring-1 focus:ring-brass-500/50 text-sm font-mono tracking-widest text-parchment-100 placeholder:text-parchment-600 outline-none uppercase transition-colors"
            />
            <button
              type="submit"
              disabled={joiningCode || !joinCode.trim()}
              className="h-11 px-5 rounded-xl bg-brass-600 hover:bg-brass-500 text-wood-950 text-xs font-bold tracking-wide uppercase disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-98 shadow"
            >
              <span>{joiningCode ? 'Joining...' : 'Join'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Custom Challenge Modal */}
      {challengeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-wood-900 border border-brass-500/30 p-6 shadow-2xl text-parchment-100 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-wood-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brass-400" />
                <h3 className="font-serif text-lg font-bold text-parchment-100">Create Private Match</h3>
              </div>
              <button
                onClick={() => setChallengeModalOpen(false)}
                className="p-1 text-parchment-400 hover:text-parchment-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Time Control Options */}
              <div>
                <label className="block text-xs font-medium text-parchment-300 uppercase tracking-wider mb-2">
                  Time Control
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {['1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '15+10', '30+0', '60+0'].map((tc) => (
                    <button
                      key={tc}
                      type="button"
                      onClick={() => setChallengeTimeControl(tc)}
                      className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer ${
                        challengeTimeControl === tc
                          ? 'bg-brass-600 text-wood-950 border-brass-500 font-bold shadow-sm'
                          : 'bg-wood-950 text-parchment-300 border-wood-800 hover:border-wood-700'
                      }`}
                    >
                      {tc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Side Selection */}
              <div>
                <label className="block text-xs font-medium text-parchment-300 uppercase tracking-wider mb-2">
                  Play As
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'random', label: 'Random', icon: Dices },
                    { id: 'white', label: 'White', color: 'bg-parchment-100' },
                    { id: 'black', label: 'Black', color: 'bg-wood-950 border border-wood-700' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setChallengeSide(s.id as 'white' | 'black' | 'random')}
                      className={`py-2.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        challengeSide === s.id
                          ? 'bg-brass-600 text-wood-950 border-brass-500 font-bold shadow-sm'
                          : 'bg-wood-950 text-parchment-300 border-wood-800 hover:border-wood-700'
                      }`}
                    >
                      {s.color && <span className={`w-3 h-3 rounded-full ${s.color}`} />}
                      {s.icon && <s.icon className="w-3.5 h-3.5" />}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rated vs Casual Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-wood-950 border border-wood-800">
                <div>
                  <div className="text-xs font-semibold text-parchment-200">Rated Game</div>
                  <div className="text-[11px] text-parchment-500">
                    Results update player ratings when both opponents have accounts.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChallengeRated(!challengeRated)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    challengeRated ? 'bg-brass-600' : 'bg-wood-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-parchment-100 shadow transition-transform absolute top-1 ${
                      challengeRated ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCreateChallenge}
                  disabled={creatingChallenge}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-wood-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-brass-700/20 cursor-pointer disabled:opacity-50"
                >
                  {creatingChallenge ? 'Generating Room...' : 'Create Match & Get Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authRequiredModalOpen}
        onClose={() => setAuthRequiredModalOpen(false)}
        defaultMode="register"
      />
    </div>
  );
}
