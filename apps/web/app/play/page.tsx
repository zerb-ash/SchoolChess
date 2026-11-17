'use client';

import React, { useState } from 'react';
import { Play, Link as LinkIcon, Shield, Sparkles, Clock, Globe } from 'lucide-react';

export default function PlayLobbyPage() {
  const [selectedTimeControl, setSelectedTimeControl] = useState('3+0');
  const [colorPref, setColorPref] = useState<'white' | 'random' | 'black'>('random');
  const [isRated, setIsRated] = useState(true);
  const [ratingRange, setRatingRange] = useState(200);

  const presets = [
    { label: '1+0', sub: 'Bullet', cat: 'bullet' },
    { label: '2+1', sub: 'Bullet', cat: 'bullet' },
    { label: '3+0', sub: 'Blitz', cat: 'blitz' },
    { label: '3+2', sub: 'Blitz', cat: 'blitz' },
    { label: '5+0', sub: 'Blitz', cat: 'blitz' },
    { label: '10+0', sub: 'Rapid', cat: 'rapid' },
    { label: '15+10', sub: 'Rapid', cat: 'rapid' },
    { label: '30+0', sub: 'Classical', cat: 'classical' },
    { label: '∞', sub: 'Untimed', cat: 'untimed' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Play className="w-6 h-6 text-emerald-400" />
          <span>Play Online</span>
        </h1>
        <p className="text-sm text-zinc-400">Select your time control, ratings pool, and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Matchmaking Card (2 cols) */}
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          {/* Time Controls */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 block">
              Time Control
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {presets.map((p) => {
                const isSelected = selectedTimeControl === p.label;
                return (
                  <button
                    key={p.label}
                    onClick={() => setSelectedTimeControl(p.label)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <span className="text-lg font-black font-mono">{p.label}</span>
                    <span className="text-[11px] font-medium text-zinc-400">{p.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Preference */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 block">
              Color Preference
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'white', label: 'White', color: 'bg-white text-zinc-950' },
                { id: 'random', label: 'Random', color: 'bg-gradient-to-r from-zinc-200 to-zinc-800 text-zinc-900' },
                { id: 'black', label: 'Black', color: 'bg-zinc-950 text-white border border-zinc-700' },
              ].map((c) => {
                const isSelected = colorPref === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setColorPref(c.id as any)}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full ${c.color}`} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating Settings */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div>
              <span className="text-sm font-bold text-zinc-200 block">Rated Match</span>
              <span className="text-xs text-zinc-400">Updates FIDE, Chess.com, and Lichess ratings</span>
            </div>
            <button
              onClick={() => setIsRated(!isRated)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                isRated ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isRated ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Find Opponent CTA */}
          <button className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-base shadow-xl shadow-emerald-500/20 transition-all hover:scale-101 active:scale-99 flex items-center justify-center gap-2">
            <Play className="w-5 h-5 fill-current" />
            <span>Find Opponent ({selectedTimeControl})</span>
          </button>
        </div>

        {/* Private Challenges Card (1 col) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-400" />
              <span>Private Challenge</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Create a direct invite link or 6-character short code to play with a friend or classmate.
            </p>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1.5 font-mono text-xs">
              <span className="text-zinc-500">Sample Join Code:</span>
              <span className="text-emerald-400 font-bold text-lg tracking-widest">K7P9XM</span>
            </div>
          </div>

          <button className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition-colors flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Create Challenge Link</span>
          </button>
        </div>
      </div>
    </div>
  );
}

