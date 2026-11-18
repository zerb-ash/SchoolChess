'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Play, Swords, Trophy, Settings, LogOut, UserPlus, LogIn, ChevronDown, Bot, User, Search, ShieldAlert, Menu, X } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { usePresence } from '../../lib/usePresence';
import { AuthModal } from '../auth/AuthModal';
import { ChessCrownIcon } from '../icons/ChessCrownIcon';
import { OwnerBadge, isOwner } from '../ui/OwnerBadge';

export const Navbar: React.FC = () => {
  usePresence();
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  interface NavLinkItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
  }

  const navLinks: NavLinkItem[] = [
    { href: '/', label: 'Home', icon: Crown },
    { href: '/play', label: 'Play', icon: Play },
    { href: '/play/computer', label: 'Computer', icon: Bot },
    { href: '/sandbox', label: 'Sandbox', icon: Swords },
    { href: '/leaderboards', label: 'Leaderboards', icon: Trophy },
    { href: '/find', label: 'Find', icon: Search },
    user
      ? {
          href: `/profile/@${user.username}`,
          label: 'Profile',
          icon: User,
        }
      : {
          href: '/settings',
          label: 'Settings',
          icon: Settings,
        },
  ];

  const openAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-wood-800/80 bg-wood-950/90 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Far Left: XChess Logo */}
          <div className="flex items-center justify-start min-w-[140px] sm:min-w-[180px]">
            <Link href="/" className="inline-flex items-baseline gap-2 group select-none">
              <span className="w-5 h-5 sm:w-6 sm:h-6 inline-block shrink-0 text-parchment-100 group-hover:text-brass-300 transition-colors align-baseline translate-y-[1px]">
                <ChessCrownIcon className="w-full h-full block" />
              </span>
              <span className="font-serif text-lg sm:text-xl font-bold tracking-wider text-parchment-100 group-hover:text-brass-300 transition-colors leading-none">
                X<span className="text-brass-400 font-normal">Chess</span>
              </span>
            </Link>
          </div>

          {/* Centered Navigation Links */}
          <nav className="hidden md:flex items-center justify-center flex-1 gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={link.onClick}
                  className={`px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-wider font-medium flex items-center gap-2 border transition-colors duration-150 select-none outline-none focus:outline-none ${
                    isActive
                      ? 'bg-wood-850 text-brass-300 border-brass-500/40 font-semibold shadow-sm'
                      : 'border-transparent text-parchment-400 hover:text-brass-300 hover:bg-wood-900/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-brass-500 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Far Right: User Auth / Account & Mobile Menu Toggle */}
          <div className="flex items-center justify-end min-w-[140px] sm:min-w-[200px] gap-2">
            {loading ? (
              <div className="w-20 h-7 bg-wood-900 rounded-md animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-wood-700 bg-wood-900 hover:bg-wood-850 text-xs text-parchment-200 transition-colors cursor-pointer"
                >
                  <div className="relative w-6 h-6 rounded-full overflow-hidden bg-wood-950 border border-brass-500/40 flex items-center justify-center text-[10px] shrink-0">
                    <span className="font-bold text-brass-400 select-none">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                    {user.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.username}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 max-w-[80px] sm:max-w-none">
                    <span className="font-medium tracking-wide truncate">{user.username}</span>
                    {isOwner(user.username) && <OwnerBadge size="xs" />}
                  </div>
                  <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-wood-950 border border-wood-800 text-brass-400 font-mono">
                    {user.ratings?.fide || 200}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-parchment-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-wood-900 border border-brass-500/20 shadow-xl shadow-black/80 py-1.5 z-50 animate-fadeIn text-xs">
                    <div className="px-3 py-2 border-b border-wood-800 text-parchment-400">
                      <div className="text-[10px] uppercase tracking-wider text-parchment-500">Signed in as</div>
                      <div className="font-semibold text-parchment-100 truncate flex items-center gap-1.5">
                        <span>@{user.username}</span>
                        {isOwner(user.username) && <OwnerBadge size="xs" />}
                      </div>
                    </div>
                    <Link
                      href={`/profile/@${user.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 transition-colors"
                    >
                      <User className="w-4 h-4 text-brass-500" />
                      <span>Profile</span>
                    </Link>
                    {user.username.toLowerCase() === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-brass-400 hover:text-brass-200 hover:bg-wood-850 transition-colors font-medium"
                      >
                        <ShieldAlert className="w-4 h-4 text-brass-400" />
                        <span>Admin Panel</span>
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-brass-500" />
                      <span>Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-wood-850 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => openAuth('login')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 hover:bg-wood-850 text-xs font-medium text-parchment-300 hover:text-parchment-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-brass-500" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="hidden sm:flex px-3.5 py-1.5 rounded-lg bg-brass-600 hover:bg-brass-500 text-wood-950 text-xs font-bold transition-all shadow-sm items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-wood-900 border border-wood-700 text-parchment-300 hover:text-parchment-100 transition-colors ml-1 cursor-pointer"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-brass-400" /> : <Menu className="w-5 h-5 text-brass-400" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden w-full border-t border-wood-800 bg-wood-950/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-1.5 animate-fadeIn shadow-2xl">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    if (link.onClick) {
                      e.preventDefault();
                      link.onClick();
                    }
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center gap-3 transition-colors duration-150 ${
                    isActive
                      ? 'bg-wood-850 text-brass-300 border border-brass-500/40 font-semibold shadow-inner'
                      : 'text-parchment-300 hover:text-brass-300 hover:bg-wood-900 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 text-brass-400" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            {user?.username?.toLowerCase() === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-semibold flex items-center gap-3 bg-wood-900 border border-brass-500/30 text-brass-400 hover:text-brass-200 hover:bg-wood-850"
              >
                <ShieldAlert className="w-4 h-4 text-brass-400" />
                <span>Admin Panel</span>
              </Link>
            )}
            {user && (
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-medium flex items-center gap-3 text-parchment-400 hover:text-parchment-200 hover:bg-wood-900"
              >
                <Settings className="w-4 h-4 text-brass-500" />
                <span>Settings</span>
              </Link>
            )}
            {!user && (
              <button
                onClick={() => openAuth('register')}
                className="mt-1 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-brass-600 hover:bg-brass-500 text-wood-950 transition-all shadow"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Free Account</span>
              </button>
            )}
          </div>
        )}
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authModalMode}
      />
    </>
  );
};
