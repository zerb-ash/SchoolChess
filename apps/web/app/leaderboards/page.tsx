'use client';

import React, { useState } from 'react';
import { Trophy, Medal, Flame, Zap, Clock, Crown } from 'lucide-react';

export default function LeaderboardsPage() {
  const [activeTab, setActiveTab] = useState<'site' | 'fide' | 'chess_com' | 'lichess'>('site');
  const [activeCat, setActiveCat] = useState<'blitz' | 'rapid' | 'bullet'>('blitz');

  const mockLeaderboard = [
    { rank: 1, username: 'GrandmasterOne', rating: 2850, games: 412, winRate: '68%' },
    { rank: 2, username: 'ChessLegend', rating: 2740, games: 320, winRate: '64%' },
    { rank: 3, username: 'KnightMaster', rating: 2680, games: 510, winRate: '61%' },
    { rank: 4, username: 'BoardWizard', rating: 2590, games: 295, winRate: '59%' },
    { rank: 5, username: 'QueenHunter', rating: 2520, games: 340, winRate: '57%' },
    { rank: 6, username: 'TacticalHawk', rating: 2470, games: 215, winRate: '56%' },
    { rank: 7, username: 'PawnPusher99', rating: 2410, games: 180, winRate: '55%' },
    { rank: 8, username: 'EndgameAce', rating: 2380, games: 420, winRate: '54%' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          <span>Competitive Leaderboards</span>
        </h1>
        <p className="text-sm text-zinc-400">Top ranked players across all competitive rating pools</p>
      </div>

      {/* Rating System Tabs */}
      <div className="flex border-b border-zinc-800 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'site', label: 'Platform Ratings' },
          { id: 'fide', label: 'FIDE-style (Elo)' },
          { id: 'chess_com', label: 'Chess.com-style (Glicko-1)' },
          { id: 'lichess', label: 'Lichess-style (Glicko-2)' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 font-bold text-xs whitespace-nowrap border-b-2 transition-all ${
                isActive
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2">
        {[
          { id: 'blitz', label: 'Blitz (3m, 5m)', icon: Flame },
          { id: 'rapid', label: 'Rapid (10m, 15m)', icon: Clock },
          { id: 'bullet', label: 'Bullet (1m, 2m)', icon: Zap },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCat === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isActive
                  ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-zinc-950/70 border-b border-zinc-800 text-zinc-400 uppercase font-semibold tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4 w-16 text-center">Rank</th>
              <th className="py-3.5 px-4">Player</th>
              <th className="py-3.5 px-4">Rating</th>
              <th className="py-3.5 px-4 hidden sm:table-cell">Games</th>
              <th className="py-3.5 px-4 hidden sm:table-cell">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-medium">
            {mockLeaderboard.map((row) => (
              <tr key={row.rank} className="hover:bg-zinc-800/40 transition-colors">
                <td className="py-3.5 px-4 text-center font-bold">
                  {row.rank === 1 ? (
                    <Crown className="w-4 h-4 text-amber-400 mx-auto" />
                  ) : row.rank === 2 ? (
                    <Medal className="w-4 h-4 text-zinc-300 mx-auto" />
                  ) : row.rank === 3 ? (
                    <Medal className="w-4 h-4 text-amber-700 mx-auto" />
                  ) : (
                    <span className="text-zinc-500 font-mono">#{row.rank}</span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-bold text-zinc-200">{row.username}</td>
                <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-base">
                  {row.rating}
                </td>
                <td className="py-3.5 px-4 text-zinc-400 font-mono hidden sm:table-cell">
                  {row.games}
                </td>
                <td className="py-3.5 px-4 text-zinc-300 font-mono hidden sm:table-cell">
                  {row.winRate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

