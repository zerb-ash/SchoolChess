'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Flame, Zap, Clock, Crown, Users } from 'lucide-react';

interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  rating: number;
  provisional: boolean;
  games: number;
  winRate: string;
}

import { getApiBaseUrl } from '../../lib/config';

const API_BASE = getApiBaseUrl();

export default function LeaderboardsPage() {
  const [activeTab, setActiveTab] = useState<'fide' | 'chess_com' | 'lichess'>('fide');
  const [activeCat, setActiveCat] = useState<'blitz' | 'rapid' | 'bullet'>('blitz');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`${API_BASE}/api/v1/leaderboards?system=${activeTab}&category=${activeCat}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setEntries(data.entries || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEntries([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, activeCat]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-parchment-100 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-brass-400" />
          <span>Competitive Leaderboards</span>
        </h1>
        <p className="text-xs text-parchment-400 mt-1">Player rankings across official rating pools</p>
      </div>

      {/* Rating System Tabs */}
      <div className="flex border-b border-wood-800 gap-2 overflow-x-auto pb-1">
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
              className={`py-2.5 px-4 font-serif font-bold text-xs whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-brass-400 text-brass-400'
                  : 'border-transparent text-parchment-400 hover:text-parchment-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category Buttons */}
      <div className="flex items-center gap-2">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                isActive
                  ? 'bg-wood-800 border-brass-500/50 text-parchment-100 shadow'
                  : 'bg-wood-950 border-wood-850 text-parchment-400 hover:text-parchment-200 hover:bg-wood-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-brass-400" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="bg-wood-900 border border-wood-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-parchment-500">
            Loading leaderboard rankings...
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
            <Users className="w-8 h-8 text-brass-500/50" />
            <span className="font-serif font-bold text-sm text-parchment-300">
              No users for this leaderboard
            </span>
            <span className="text-xs text-parchment-500 max-w-sm">
              Rankings update automatically once rated competitive matches conclude.
            </span>
          </div>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-wood-950 border-b border-wood-800 text-parchment-400 uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4 hidden sm:table-cell">Games</th>
                <th className="py-3 px-4 hidden sm:table-cell">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-800/60 font-medium">
              {entries.map((row, idx) => {
                const rank = idx + 1;
                return (
                  <tr key={row.userId} className="hover:bg-wood-850/50 transition-colors">
                    <td className="py-3 px-4 text-center font-bold">
                      {rank === 1 ? (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-wood-950 font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/20 mx-auto border border-amber-200">
                          1
                        </div>
                      ) : rank === 2 ? (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-md mx-auto border border-slate-100">
                          2
                        </div>
                      ) : rank === 3 ? (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100 font-black text-xs flex items-center justify-center shadow-md mx-auto border border-amber-500">
                          3
                        </div>
                      ) : (
                        <span className="text-parchment-500 font-mono text-xs">#{rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-parchment-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-wood-950 border border-brass-500/30 flex items-center justify-center font-bold text-xs text-brass-400 shrink-0 shadow-inner">
                          {row.avatarUrl ? (
                            <img src={row.avatarUrl} alt={row.username} className="w-full h-full object-cover" />
                          ) : (
                            <span>{row.username[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <a href={`/profile/@${row.username}`} className="hover:text-brass-400 transition-colors">
                          {row.username}
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-brass-400 text-sm">
                      {row.rating}
                      {row.provisional && <span className="text-[10px] text-parchment-500 font-normal ml-1">?</span>}
                    </td>
                    <td className="py-3 px-4 text-parchment-400 font-mono hidden sm:table-cell">
                      {row.games}
                    </td>
                    <td className="py-3 px-4 text-parchment-300 font-mono hidden sm:table-cell">
                      {row.winRate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
