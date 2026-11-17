'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Play, Swords, Trophy, Settings, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home', icon: Crown },
    { href: '/play', label: 'Play Online', icon: Play },
    { href: '/sandbox', label: 'Pass & Play', icon: Swords },
    { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Crown className="w-5 h-5 text-zinc-950 font-bold" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
            School<span className="text-emerald-400">Chess</span>
          </span>
        </Link>

        {/* Navigation items */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile / Guest pill */}
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span>Guest</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

