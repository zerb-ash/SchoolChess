'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Flame, Zap, Clock, Users, ChevronDown, ChevronUp, Swords, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getApiBaseUrl } from '../../lib/config';
import { OwnerBadge, isOwner } from '../../components/ui/OwnerBadge';

interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  rating: number;
  provisional: boolean;
  games: number;
  winRate: string;
}

const API_BASE = getApiBaseUrl();

export default function LeaderboardsPage() {
  const [activeTab, setActiveTab] = useState<'fide' | 'chess_com' | 'lichess'>('fide');
  const [activeCat, setActiveCat] = useState<'blitz' | 'rapid' | 'bullet'>('blitz');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTop50, setShowTop50] = useState(false);

  // In-memory cache to prevent flicker/loading jumps when toggling tabs
  const cacheRef = useRef<Record<string, LeaderboardEntry[]>>({});

  useEffect(() => {
    const cacheKey = `${activeTab}_${activeCat}`;
    let isMounted = true;

    if (cacheRef.current[cacheKey]) {
      setEntries(cacheRef.current[cacheKey]);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    fetch(`${API_BASE}/api/v1/leaderboards?system=${activeTab}&category=${activeCat}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          const list = data.entries || [];
          cacheRef.current[cacheKey] = list;
          setEntries(list);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          if (!cacheRef.current[cacheKey]) {
            setEntries([]);
          }
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, activeCat]);

  // Display top 10 by default, or top 50 if toggled
  const displayedEntries = showTop50 ? entries.slice(0, 50) : entries.slice(0, 10);

  const getSystemLabel = (id: string) => {
    if (id === 'fide') return 'FIDE (Standard Elo)';
    if (id === 'chess_com') return 'Chess.com (Glicko-1)';
    return 'Lichess (Glicko-2)';
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wood-800 pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-parchment-100 flex items-center gap-3">
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-brass-400" />
            <span>Leaderboards</span>
          </h1>
          <p className="text-xs sm:text-sm text-parchment-400 mt-1">
            Global player rankings across {getSystemLabel(activeTab)}
          </p>
        </div>

        <Link
          href="/play"
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-wood-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
        >
          <Swords className="w-4 h-4" />
          <span>Play Rated Match</span>
        </Link>
      </div>

      {/* Rating System Tabs */}
      <div className="flex border-b border-wood-800 gap-2 sm:gap-4 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'fide', label: 'FIDE' },
          { id: 'chess_com', label: 'Chess.com' },
          { id: 'lichess', label: 'Lichess' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 sm:px-6 font-serif font-bold text-xs sm:text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-brass-400 text-brass-300 font-extrabold'
                  : 'border-transparent text-parchment-400 hover:text-parchment-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category Buttons */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'blitz', label: 'Blitz', icon: Flame },
          { id: 'rapid', label: 'Rapid', icon: Clock },
          { id: 'bullet', label: 'Bullet', icon: Zap },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all border cursor-pointer shrink-0 shadow-sm ${
                isActive
                  ? 'bg-wood-850 border-brass-500/60 text-brass-300 shadow-md font-bold'
                  : 'bg-wood-950 border-wood-800 text-parchment-400 hover:text-parchment-200 hover:bg-wood-900'
              }`}
            >
              <Icon className="w-4 h-4 text-brass-400" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grand Leaderboard Card */}
      <div className="bg-wood-900 border border-wood-800 rounded-3xl overflow-hidden shadow-2xl">
        {isLoading && entries.length === 0 ? (
          <div className="py-20 text-center text-sm text-parchment-400">
            Loading leaderboard rankings...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-center px-4">
            <Users className="w-12 h-12 text-brass-500/40" />
            <span className="font-serif font-bold text-base text-parchment-200">
              No players currently ranked
            </span>
            <span className="text-xs text-parchment-400 max-w-md">
              Rankings update automatically once rated competitive matches conclude.
            </span>
            <Link
              href="/play"
              className="mt-2 px-4 py-2 rounded-xl bg-wood-850 border border-brass-500/30 text-brass-400 text-xs font-semibold hover:bg-wood-800 transition-colors"
            >
              Start First Match
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-wood-950/80 border-b border-wood-800 text-parchment-400 uppercase font-bold tracking-wider text-[11px] sm:text-xs">
                  <tr>
                    <th className="py-4 px-4 sm:px-6 w-16 sm:w-20 text-center">Rank</th>
                    <th className="py-4 px-4 sm:px-6">Player</th>
                    <th className="py-4 px-4 sm:px-6 text-right sm:text-left">Rating</th>
                    <th className="py-4 px-6 hidden sm:table-cell">Games</th>
                    <th className="py-4 px-6 hidden sm:table-cell">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wood-800/60 font-medium">
                  {displayedEntries.map((row, idx) => {
                    const rank = idx + 1;
                    return (
                      <tr key={row.userId} className="hover:bg-wood-850/60 transition-colors group">
                        {/* Rank Badge */}
                        <td className="py-4 sm:py-5 px-4 sm:px-6 text-center font-bold">
                          {rank === 1 ? (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-wood-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-500/20 mx-auto border border-amber-200">
                              1
                            </div>
                          ) : rank === 2 ? (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-md mx-auto border border-slate-100">
                              2
                            </div>
                          ) : rank === 3 ? (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100 font-black text-sm flex items-center justify-center shadow-md mx-auto border border-amber-500">
                              3
                            </div>
                          ) : (
                            <span className="text-parchment-500 font-mono text-sm sm:text-base font-bold">#{rank}</span>
                          )}
                        </td>

                        {/* Player Info with Big Avatar */}
                        <td className="py-4 sm:py-5 px-4 sm:px-6 font-bold text-parchment-100">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-wood-950 border-2 border-brass-500/40 flex items-center justify-center font-bold text-sm sm:text-base text-brass-400 shrink-0 shadow-inner group-hover:border-brass-400 transition-colors">
                              {row.avatarUrl ? (
                                <img
                                  src={row.avatarUrl}
                                  alt={row.username}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="font-serif font-black">{row.username[0]?.toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <Link
                                href={`/profile/@${row.username}`}
                                className="font-serif font-bold text-sm sm:text-base text-parchment-100 hover:text-brass-300 transition-colors truncate max-w-[140px] sm:max-w-none flex items-center gap-1.5"
                              >
                                <span>{row.username}</span>
                                {isOwner(row.username) && <OwnerBadge size="xs" />}
                              </Link>
                              {/* Mobile-only stats row */}
                              <span className="text-[11px] text-parchment-500 font-mono sm:hidden mt-0.5">
                                {row.games} games • {row.winRate} win
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Rating */}
                        <td className="py-4 sm:py-5 px-4 sm:px-6 font-mono font-bold text-brass-400 text-base sm:text-lg text-right sm:text-left">
                          {row.rating}
                          {row.provisional && (
                            <span className="text-xs text-parchment-500 font-normal ml-1" title="Provisional rating">
                              ?
                            </span>
                          )}
                        </td>

                        {/* Desktop Stats */}
                        <td className="py-4 sm:py-5 px-6 text-parchment-300 font-mono text-sm hidden sm:table-cell">
                          {row.games}
                        </td>
                        <td className="py-4 sm:py-5 px-6 text-parchment-200 font-mono text-sm hidden sm:table-cell">
                          {row.winRate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* View More (Top 50) Button */}
            {entries.length > 10 && (
              <div className="p-4 bg-wood-950/60 border-t border-wood-800 flex justify-center">
                <button
                  onClick={() => setShowTop50(!showTop50)}
                  className="px-5 py-2.5 rounded-xl bg-wood-850 hover:bg-wood-800 border border-brass-500/40 text-brass-300 hover:text-brass-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  {showTop50 ? (
                    <>
                      <span>Show Top 10 Only</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>View More (Top 50)</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Informational Footer Strip so table looks complete and grand */}
            <div className="px-6 py-4 bg-wood-950/40 border-t border-wood-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-parchment-400">
              <span className="text-center sm:text-left">
                Rankings calculated automatically using official {getSystemLabel(activeTab)} formulas.
              </span>
              <span className="font-mono text-[11px] text-brass-400/80">
                Active Pool: {activeCat.toUpperCase()}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
