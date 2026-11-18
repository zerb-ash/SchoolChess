'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Swords, ArrowRight, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { AuthModal } from '../components/auth/AuthModal';
import { BulletIcon, BlitzIcon, RapidIcon } from '../components/icons/ChessModeIcons';

export default function HomePage() {
  const { user, refreshUser } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'blitz' | 'rapid' | 'bullet'>('blitz');

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user?.ratings?.primaryCategory && (user.ratings.primaryCategory === 'rapid' || user.ratings.primaryCategory === 'bullet' || user.ratings.primaryCategory === 'blitz')) {
      setSelectedCategory(user.ratings.primaryCategory);
    }
  }, [user?.ratings?.primaryCategory]);

  const catRatings = user?.ratings?.byCategory?.[selectedCategory] || {
    fide: user?.ratings?.fide || 200,
    chesscom: user?.ratings?.chesscom || 200,
    lichess: user?.ratings?.lichess || 200,
  };

  const timeControls = [
    { title: '1 min', sub: 'Bullet', speed: '1+0', icon: BulletIcon },
    { title: '3 min', sub: 'Blitz', speed: '3+0', icon: BlitzIcon },
    { title: '5 min', sub: 'Blitz', speed: '5+0', icon: BlitzIcon },
    { title: '10 min', sub: 'Rapid', speed: '10+0', icon: RapidIcon },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col gap-12">
      <div
        className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-wood-900 border border-brass-500/30 shadow-2xl shadow-black/80 flex flex-col md:flex-row items-center justify-between gap-8"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(197, 168, 88, 0.10) 0%, transparent 60%)',
        }}
      >
        <div className="flex flex-col gap-5 max-w-xl">
          <h1 className="text-3xl sm:text-5xl font-serif tracking-normal text-parchment-100 leading-tight">
            Play Chess with <span className="text-brass-300 italic font-serif">Confidence</span>
          </h1>

          <p className="text-parchment-300 text-sm leading-relaxed">
            Multiplayer chess with rapid pairings, bot training, and multi-system ratings.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/play"
              className="px-6 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-wood-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-brass-700/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Play</span>
            </Link>

            <Link
              href="/sandbox"
              className="px-6 py-3 min-h-[44px] rounded-xl bg-wood-950 hover:bg-wood-850 text-parchment-200 font-semibold text-xs uppercase tracking-wider border border-wood-700 hover:border-brass-500/40 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Swords className="w-4 h-4 text-brass-400 shrink-0" />
              <span>Sandbox</span>
            </Link>

            {!user && (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="hidden sm:inline-flex px-5 py-3 min-h-[44px] text-xs font-semibold uppercase tracking-wider text-brass-400 hover:text-brass-300 transition-colors items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Create Account</span>
              </button>
            )}
          </div>
        </div>

        <div className="w-full md:w-84 bg-wood-950/90 border border-brass-500/30 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-wood-800 pb-3 gap-2">
            <span className="text-xs font-serif font-bold tracking-wider text-parchment-200 uppercase whitespace-nowrap">
              Your Ratings
            </span>
            <div className="flex items-center bg-wood-900/90 rounded-lg p-0.5 border border-wood-800 text-[10px] font-semibold">
              {(['blitz', 'rapid', 'bullet'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded capitalize transition-colors ${
                    selectedCategory === cat
                      ? 'bg-brass-500/20 text-brass-300 font-bold shadow-sm'
                      : 'text-parchment-400 hover:text-parchment-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-wood-900 border border-wood-800">
              <span className="text-xs text-parchment-200 font-medium">FIDE Elo</span>
              <span className="text-base font-bold text-parchment-100 font-mono">
                {catRatings.fide}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-wood-900 border border-wood-800">
              <span className="text-xs text-parchment-200 font-medium">Chess.com</span>
              <span className="text-base font-bold text-brass-400 font-mono">
                {catRatings.chesscom}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-wood-900 border border-wood-800">
              <span className="text-xs text-parchment-200 font-medium">Lichess</span>
              <span className="text-base font-bold text-parchment-300 font-mono">
                {catRatings.lichess}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif text-parchment-100 flex items-center gap-2">
            <span>Quick Pairings</span>
          </h2>
          <Link
            href="/play"
            className="text-xs text-brass-400 hover:text-brass-300 flex items-center gap-1 uppercase tracking-wider font-semibold"
          >
            <span>All Modes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {timeControls.map((tc) => {
            const Icon = tc.icon;
            return (
              <Link
                key={tc.speed}
                href={`/play?timeControl=${tc.speed}`}
                className="p-5 rounded-2xl bg-wood-900 border border-wood-800 hover:border-brass-500/40 hover:bg-wood-850 flex flex-col gap-2 transition-all hover:-translate-y-0.5 shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <Icon className="w-5 h-5 group-hover:scale-110 transition-transform drop-shadow" />
                  <span className="text-xs font-mono font-bold text-parchment-500 group-hover:text-brass-300">
                    {tc.speed}
                  </span>
                </div>
                <div className="text-2xl font-serif font-bold text-parchment-100 mt-2">{tc.title}</div>
                <div className="text-xs text-parchment-400 font-medium">{tc.sub}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode="register"
      />
    </div>
  );
}
