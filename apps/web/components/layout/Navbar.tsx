'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Play, Swords, Trophy, Settings, LogOut, UserPlus, LogIn, ChevronDown } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { AuthModal } from '../auth/AuthModal';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Salon', icon: Crown },
    { href: '/play', label: 'Play Online', icon: Play },
    { href: '/sandbox', label: 'Pass & Play', icon: Swords },
    { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const openAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    setDropdownOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-wood-800/80 bg-wood-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-wood-900 border border-brass-500/40 flex items-center justify-center shadow-md group-hover:border-brass-400 transition-colors">
              <Crown className="w-5 h-5 text-brass-400 group-hover:scale-105 transition-transform" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg font-bold tracking-wider text-parchment-100 group-hover:text-brass-300 transition-colors">
                School<span className="text-brass-400 font-normal">Chess</span>
              </span>
              <span className="text-[9px] uppercase tracking-widest text-parchment-500 font-mono -mt-1">
                Grandmaster Salon
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-md text-xs uppercase tracking-wider font-medium flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-wood-850 text-brass-300 border border-brass-500/30 font-semibold shadow-sm'
                      : 'text-parchment-400 hover:text-parchment-100 hover:bg-wood-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-brass-500" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {loading ? (
              <div className="w-20 h-7 bg-wood-900 rounded-md animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 hover:bg-wood-850 text-xs text-parchment-200 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-brass-600 text-wood-950 font-bold flex items-center justify-center text-[10px]">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium tracking-wide">{user.username}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-wood-950 border border-wood-800 text-brass-400 font-mono">
                    {user.ratings?.fide || 1600}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-parchment-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-wood-900 border border-brass-500/20 shadow-xl shadow-black/80 py-1.5 z-50 animate-fadeIn text-xs">
                    <div className="px-3 py-2 border-b border-wood-800 text-parchment-400">
                      <div className="text-[10px] uppercase tracking-wider text-parchment-500">Signed in as</div>
                      <div className="font-semibold text-parchment-100 truncate">{user.username}</div>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-brass-500" />
                      <span>Preferences</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-wood-850 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth('login')}
                  className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 hover:bg-wood-850 text-xs font-medium text-parchment-300 hover:text-parchment-100 transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-brass-500" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="px-3.5 py-1.5 rounded-lg bg-brass-600 hover:bg-brass-500 text-wood-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authModalMode}
      />
    </>
  );
};
