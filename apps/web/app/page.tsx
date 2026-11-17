import Link from 'next/link';
import { Play, Swords, Trophy, Zap, Clock, ShieldCheck, Flame } from 'lucide-react';

export default function HomePage() {
  const timeControls = [
    { title: '1 min', sub: 'Bullet', speed: '1+0', icon: Zap, color: 'text-amber-400', bg: 'hover:border-amber-500/40' },
    { title: '3 min', sub: 'Blitz', speed: '3+0', icon: Flame, color: 'text-orange-400', bg: 'hover:border-orange-500/40' },
    { title: '5 min', sub: 'Blitz', speed: '5+0', icon: Flame, color: 'text-orange-400', bg: 'hover:border-orange-500/40' },
    { title: '10 min', sub: 'Rapid', speed: '10+0', icon: Clock, color: 'text-emerald-400', bg: 'hover:border-emerald-500/40' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-10">
      {/* Hero Banner */}
      <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-zinc-900 via-zinc-900 to-emerald-950/40 border border-zinc-800 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Server-Authoritative • Tri-Rating Engine</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Play Chess with <span className="text-emerald-400">Triple Integrity</span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Experience sub-50ms real-time chess with simultaneous FIDE-style, Chess.com-style, and Lichess-style rating calculations on every match.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/play"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Online</span>
            </Link>
            <Link
              href="/sandbox"
              className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm border border-zinc-700 transition-all flex items-center gap-2"
            >
              <Swords className="w-4 h-4" />
              <span>Pass & Play</span>
            </Link>
          </div>
        </div>

        {/* Triple Rating Snapshot Card */}
        <div className="w-full md:w-80 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Your Ratings</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
              3 ACTIVE POOLS
            </span>
          </div>
          
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80">
              <span className="text-xs text-zinc-400 font-medium">FIDE-style (Elo)</span>
              <span className="text-sm font-bold text-zinc-200 font-mono">1,620</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80">
              <span className="text-xs text-zinc-400 font-medium">Chess.com-style (Glicko-1)</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">1,780</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80">
              <span className="text-xs text-zinc-400 font-medium">Lichess-style (Glicko-2)</span>
              <span className="text-sm font-bold text-blue-400 font-mono">1,890</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Play Presets */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          <span>Quick Matchmaking</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {timeControls.map((tc) => {
            const Icon = tc.icon;
            return (
              <Link
                key={tc.speed}
                href={`/play?timeControl=${tc.speed}`}
                className={`p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col gap-2 transition-all hover:scale-102 hover:-translate-y-0.5 shadow-lg group ${tc.bg}`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-5 h-5 ${tc.color}`} />
                  <span className="text-xs font-mono font-bold text-zinc-500 group-hover:text-zinc-300">
                    {tc.speed}
                  </span>
                </div>
                <div className="text-2xl font-black text-white">{tc.title}</div>
                <div className="text-xs font-semibold text-zinc-400">{tc.sub}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

