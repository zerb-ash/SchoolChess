'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../lib/useAuth';
import {
  Gem,
  Calendar,
  Eye,
  Clock,
  Flame,
  Edit3,
  Check,
  X,
  Swords,
  Trophy,
  ShieldAlert,
  User,
  Radio,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { MiniBoard } from '../../../components/board/MiniBoard';
import { BulletIcon, BlitzIcon, RapidIcon, ClassicalIcon } from '../../../components/icons/ChessModeIcons';

interface UserProfileData {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string;
  views: number;
  createdAt: string;
  lastSeenAt: string;
}

interface CompletedGame {
  id: string;
  timeControl: string;
  category: string;
  whiteUserId: string;
  whiteUsername: string;
  whiteRating: number;
  whiteAvatarUrl?: string;
  blackUserId: string;
  blackUsername: string;
  blackRating: number;
  blackAvatarUrl?: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: string;
  movesCount: number;
  accuracyWhite?: number;
  accuracyBlack?: number;
  finalFen?: string;
  playedAt: string;
}

function getSpeedBadge(timeControl: string, category?: string) {
  const cat = (category || '').toLowerCase();
  const tc = timeControl || '';

  const isBullet = cat === 'bullet' || tc === '1+0' || tc === '1+1' || tc === '2+1';
  const isBlitz = cat === 'blitz' || tc === '3+0' || tc === '3+2' || tc === '5+0' || tc === '5+3';
  const isRapid = cat === 'rapid' || tc === '10+0' || tc === '15+10' || tc === '30+0';

  let timeLabel = tc;
  if (tc === '1+0') timeLabel = '1 min';
  else if (tc === '1+1') timeLabel = '1 | 1';
  else if (tc === '2+1') timeLabel = '2 | 1';
  else if (tc === '3+0') timeLabel = '3 min';
  else if (tc === '3+2') timeLabel = '3 | 2';
  else if (tc === '5+0') timeLabel = '5 min';
  else if (tc === '5+3') timeLabel = '5 | 3';
  else if (tc === '10+0') timeLabel = '10 min';
  else if (tc === '15+10') timeLabel = '15 | 10';
  else if (tc === '30+0') timeLabel = '30 min';
  else if (tc === '30+20') timeLabel = '30 | 20';
  else if (tc === '60+0') timeLabel = '60 min';

  if (isBullet) {
    return {
      name: 'Bullet',
      timeLabel,
      Icon: BulletIcon,
      color: '#f97316',
    };
  }
  if (isBlitz) {
    return {
      name: 'Blitz',
      timeLabel,
      Icon: BlitzIcon,
      color: '#facc15',
    };
  }
  if (isRapid) {
    return {
      name: 'Rapid',
      timeLabel,
      Icon: RapidIcon,
      color: '#22c55e',
    };
  }
  return {
    name: 'Classical',
    timeLabel,
    Icon: ClassicalIcon,
    color: '#eab308',
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Online now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export default function UserProfilePage() {
  const params = useParams();
  const rawUsername = params.username as string;
  const username = decodeURIComponent(rawUsername).replace(/^@/, '');

  const { user: currentUser, updateUser, refreshUser } = useAuth();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [ratings, setRatings] = useState<{ rapid: number; blitz: number; bullet: number }>({
    rapid: 200,
    blitz: 200,
    bullet: 200,
  });
  const [games, setGames] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'stats'>('overview');
  const [gamesPage, setGamesPage] = useState(1);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const isOwnProfile =
    currentUser && currentUser.username.toLowerCase() === username.toLowerCase();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch(`${API_BASE}/api/v1/users/${username}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setProfile(data.user);
        setRatings(data.ratings || { rapid: 200, blitz: 200, bullet: 200 });
        setGames(data.games || []);
        setEditBio(data.user.bio || '');
        setEditAvatarUrl(data.user.avatarUrl || '');
        setLoading(false);

        // Record profile view only if visitor is not viewing own profile and hasn't viewed in this session
        const isOwn = currentUser && currentUser.username.toLowerCase() === username.toLowerCase();
        const sessionKey = `viewed_profile_${username}`;
        if (!isOwn && typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1');
          fetch(`${API_BASE}/api/v1/users/${username}/view`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => {});
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [username]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/users/${username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: editBio,
          avatarUrl: editAvatarUrl,
        }),
      });

      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, bio: editBio, avatarUrl: editAvatarUrl } : null));
        if (isOwnProfile) {
          updateUser({ bio: editBio, avatarUrl: editAvatarUrl });
          await refreshUser();
        }
        setEditModalOpen(false);
      }
    } catch {
      // Ignore
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-xs text-parchment-400">
        Loading player profile...
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center flex flex-col items-center gap-3">
        <ShieldAlert className="w-10 h-10 text-brass-500/50" />
        <h1 className="font-serif font-bold text-lg text-parchment-100">Player Not Found</h1>
        <p className="text-xs text-parchment-400">No user exists with username @{username}.</p>
      </div>
    );
  }

  const isOnline = formatRelativeTime(profile.lastSeenAt) === 'Online now';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header Profile Card */}
      <div className="w-full bg-wood-900 border border-wood-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="relative group">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-wood-950 border-2 border-brass-500/40 shadow-inner flex items-center justify-center">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <span className="font-serif font-black text-3xl text-brass-400">
                {profile.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {isOnline && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-wood-900 shadow" />
          )}
        </div>

        {/* Profile Details */}
        <div className="flex-1 flex flex-col gap-2 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-parchment-100 tracking-wide">
                {profile.username}
              </h1>
            </div>

            {isOwnProfile && (
              <button
                onClick={() => setEditModalOpen(true)}
                className="px-4 py-2 rounded-xl border border-wood-700 bg-wood-950 hover:bg-wood-850 text-xs font-semibold text-parchment-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-brass-400" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {/* Bio */}
          <p className="text-xs text-parchment-300 italic max-w-xl">
            {profile.bio || 'No bio'}
          </p>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-[11px] text-parchment-400 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-brass-500" />
              Joined {formatDate(profile.createdAt)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-brass-500" />
              {profile.views} Views
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-parchment-500'}`} />
              {formatRelativeTime(profile.lastSeenAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-wood-800 gap-2">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'games', label: `Games (${games.length})` },
          { id: 'stats', label: 'Stats' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-5 font-serif font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
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

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="w-full flex flex-col gap-6">
          {/* Rating Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-wood-950 border border-wood-800 flex items-center justify-center">
                  <RapidIcon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-serif uppercase tracking-wider text-parchment-400 block font-bold">
                    Rapid
                  </span>
                  <span className="text-xl font-mono font-bold text-parchment-100">
                    {ratings.rapid}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-wood-950 border border-wood-800 flex items-center justify-center">
                  <BlitzIcon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-serif uppercase tracking-wider text-parchment-400 block font-bold">
                    Blitz
                  </span>
                  <span className="text-xl font-mono font-bold text-parchment-100">
                    {ratings.blitz}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-wood-950 border border-wood-800 flex items-center justify-center">
                  <BulletIcon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-serif uppercase tracking-wider text-parchment-400 block font-bold">
                    Bullet
                  </span>
                  <span className="text-xl font-mono font-bold text-parchment-100">
                    {ratings.bullet}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Game History */}
          <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
                <Swords className="w-4 h-4 text-brass-400" />
                <span>Game History</span>
              </h2>
              {games.length > 5 && (
                <button
                  onClick={() => {
                    setActiveTab('games');
                    setGamesPage(1);
                  }}
                  className="text-xs font-serif font-semibold text-brass-400 hover:text-brass-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View All ({games.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {games.length === 0 ? (
              <div className="py-12 text-center text-xs text-parchment-500">
                No recorded player vs player games yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-wood-800">
                {games.slice(0, 5).map((g) => {
                  const isWhite = g.whiteUserId === profile.id;
                  const won = (isWhite && g.result === '1-0') || (!isWhite && g.result === '0-1');
                  const draw = g.result === '1/2-1/2';
                  const speed = getSpeedBadge(g.timeControl, g.category);
                  const isWhiteProfile = g.whiteUsername.toLowerCase() === profile.username.toLowerCase();
                  const isBlackProfile = g.blackUsername.toLowerCase() === profile.username.toLowerCase();

                  return (
                    <div key={g.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3.5">
                        {/* Speed Icon & Time */}
                        <div className="flex flex-col items-center justify-center gap-0.5 w-12 shrink-0 text-center">
                          <speed.Icon className="w-5 h-5 drop-shadow-sm" />
                          <span className="text-[10px] font-bold text-parchment-200">{speed.timeLabel}</span>
                        </div>

                        {/* Players */}
                        <div className="flex flex-col gap-1.5">
                          {/* White */}
                          <div className="flex items-center gap-2">
                            {isWhiteProfile ? (
                              <div className="w-6 h-6 rounded-md overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center shrink-0">
                                {g.whiteAvatarUrl ? (
                                  <img src={g.whiteAvatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-serif font-bold text-[10px] text-brass-400">
                                    {g.whiteUsername.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link href={`/profile/${g.whiteUsername}`} className="shrink-0 group/av" title={`View @${g.whiteUsername}'s profile`}>
                                <div className="w-6 h-6 rounded-md overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center group-hover/av:border-brass-400 transition-colors">
                                  {g.whiteAvatarUrl ? (
                                    <img src={g.whiteAvatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-serif font-bold text-[10px] text-brass-400">
                                      {g.whiteUsername.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}
                            <span className="w-2.5 h-2.5 rounded-sm bg-parchment-100 border border-wood-700 shrink-0" />
                            {isWhiteProfile ? (
                              <span className="font-bold text-parchment-100">
                                {g.whiteUsername}
                              </span>
                            ) : (
                              <Link
                                href={`/profile/${g.whiteUsername}`}
                                className="font-semibold text-parchment-300 hover:underline hover:text-brass-300 transition-colors"
                              >
                                {g.whiteUsername}
                              </Link>
                            )}
                            <span className="text-parchment-500 font-mono text-[11px]">({g.whiteRating})</span>
                          </div>

                          {/* Black */}
                          <div className="flex items-center gap-2">
                            {isBlackProfile ? (
                              <div className="w-6 h-6 rounded-md overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center shrink-0">
                                {g.blackAvatarUrl ? (
                                  <img src={g.blackAvatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-serif font-bold text-[10px] text-brass-400">
                                    {g.blackUsername.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link href={`/profile/${g.blackUsername}`} className="shrink-0 group/av" title={`View @${g.blackUsername}'s profile`}>
                                <div className="w-6 h-6 rounded-md overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center group-hover/av:border-brass-400 transition-colors">
                                  {g.blackAvatarUrl ? (
                                    <img src={g.blackAvatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-serif font-bold text-[10px] text-brass-400">
                                      {g.blackUsername.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}
                            <span className="w-2.5 h-2.5 rounded-sm bg-wood-950 border border-brass-500/40 shrink-0" />
                            {isBlackProfile ? (
                              <span className="font-bold text-parchment-100">
                                {g.blackUsername}
                              </span>
                            ) : (
                              <Link
                                href={`/profile/${g.blackUsername}`}
                                className="font-semibold text-parchment-300 hover:underline hover:text-brass-300 transition-colors"
                              >
                                {g.blackUsername}
                              </Link>
                            )}
                            <span className="text-parchment-500 font-mono text-[11px]">({g.blackRating})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              won
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : draw
                                ? 'bg-wood-800 text-parchment-300'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {g.result}
                          </span>
                          <span className="text-[10px] text-parchment-500 block mt-0.5">
                            {g.movesCount} moves • {formatDate(g.playedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {games.length > 5 && (
              <button
                onClick={() => {
                  setActiveTab('games');
                  setGamesPage(1);
                }}
                className="w-full py-2.5 rounded-xl bg-wood-950 hover:bg-wood-850 border border-wood-800 text-xs font-semibold text-brass-400 hover:text-brass-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>View All Games ({games.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'games' && (() => {
        const totalPages = Math.ceil(games.length / 10) || 1;
        const currentGames = games.slice((gamesPage - 1) * 10, gamesPage * 10);

        return (
          <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
                <Swords className="w-4 h-4 text-brass-400" />
                <span>All Games ({games.length})</span>
              </h2>
              <span className="text-xs font-mono text-parchment-400">
                Page {gamesPage} of {totalPages}
              </span>
            </div>

            {games.length === 0 ? (
              <div className="py-16 text-center text-xs text-parchment-500">
                No rated player games recorded for @{profile.username}.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-wood-800/80">
                {currentGames.map((g) => {
                  const isWhite = g.whiteUserId === profile.id;
                  const won = (isWhite && g.result === '1-0') || (!isWhite && g.result === '0-1');
                  const draw = g.result === '1/2-1/2';
                  const userWon = won;
                  const userLost = !won && !draw;

                  const outcomeText = userWon ? 'Won' : userLost ? 'Lost' : 'Draw';
                  const terminationLabel =
                    g.termination === 'checkmate'
                      ? 'Checkmate'
                      : g.termination === 'resignation'
                      ? 'Resignation'
                      : g.termination === 'timeout'
                      ? 'Timeout'
                      : g.termination === 'draw_agreed' || g.termination === 'draw_agreement'
                      ? 'Draw by agreement'
                      : g.termination === 'stalemate'
                      ? 'Stalemate'
                      : g.termination === 'repetition'
                      ? 'Repetition'
                      : g.termination === 'insufficient_material'
                      ? 'Insufficient material'
                      : g.termination === 'abandoned'
                      ? 'Abandoned'
                      : g.termination || 'Completed';

                  const speed = getSpeedBadge(g.timeControl, g.category);
                  const isWhiteProfile = g.whiteUsername.toLowerCase() === profile.username.toLowerCase();
                  const isBlackProfile = g.blackUsername.toLowerCase() === profile.username.toLowerCase();

                  return (
                    <div
                      key={g.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-wood-850/50 -mx-3 px-3 rounded-xl transition-colors"
                    >
                      {/* Left: 156px MiniBoard (1.5x) + Speed Badge + Player details */}
                      <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                        {/* 1.5x Larger Final Position Mini Board Preview (156px) */}
                        <div className="shrink-0 rounded-lg overflow-hidden border border-wood-700/60 shadow-md">
                          <MiniBoard fen={g.finalFen} size={156} />
                        </div>

                        {/* Game Type Logo & Time (Prominent Chess.com layout) */}
                        <div className="flex flex-col items-center justify-center gap-1 w-16 shrink-0 text-center">
                          <speed.Icon className="w-8 h-8 drop-shadow" />
                          <span className="text-xs font-bold text-parchment-200">
                            {speed.timeLabel}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-parchment-400 font-bold">
                            {speed.name}
                          </span>
                        </div>

                        {/* Player Names & Ratings with Profile Avatars & Selective Hyperlinks */}
                        <div className="flex flex-col gap-2.5 min-w-0">
                          {/* White Player */}
                          <div className="flex items-center gap-2.5 text-sm">
                            {isWhiteProfile ? (
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center shadow-inner shrink-0">
                                {g.whiteAvatarUrl ? (
                                  <img src={g.whiteAvatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-serif font-bold text-xs text-brass-400">
                                    {g.whiteUsername.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link
                                href={`/profile/${g.whiteUsername}`}
                                className="shrink-0 group/av"
                                title={`View @${g.whiteUsername}'s profile`}
                              >
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center shadow-inner group-hover/av:border-brass-400 transition-colors">
                                  {g.whiteAvatarUrl ? (
                                    <img src={g.whiteAvatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-serif font-bold text-xs text-brass-400">
                                      {g.whiteUsername.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}

                            <div className="w-3 h-3 rounded-sm bg-parchment-100 border border-wood-700 shrink-0" />
                            {isWhiteProfile ? (
                              <span className="font-bold text-parchment-100 truncate max-w-[140px] sm:max-w-[200px]">
                                {g.whiteUsername}
                              </span>
                            ) : (
                              <Link
                                href={`/profile/${g.whiteUsername}`}
                                className="font-semibold text-parchment-300 hover:underline hover:text-brass-300 transition-colors truncate max-w-[140px] sm:max-w-[200px]"
                              >
                                {g.whiteUsername}
                              </Link>
                            )}
                            <span className="text-xs font-mono text-parchment-400 font-medium">
                              ({g.whiteRating})
                            </span>
                          </div>

                          {/* Black Player */}
                          <div className="flex items-center gap-2.5 text-sm">
                            {isBlackProfile ? (
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center shadow-inner shrink-0">
                                {g.blackAvatarUrl ? (
                                  <img src={g.blackAvatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-serif font-bold text-xs text-brass-400">
                                    {g.blackUsername.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link
                                href={`/profile/${g.blackUsername}`}
                                className="shrink-0 group/av"
                                title={`View @${g.blackUsername}'s profile`}
                              >
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-wood-950 border border-wood-700 flex items-center justify-center shadow-inner group-hover/av:border-brass-400 transition-colors">
                                  {g.blackAvatarUrl ? (
                                    <img src={g.blackAvatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-serif font-bold text-xs text-brass-400">
                                      {g.blackUsername.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            )}

                            <div className="w-3 h-3 rounded-sm bg-wood-950 border border-brass-500/40 shrink-0" />
                            {isBlackProfile ? (
                              <span className="font-bold text-parchment-100 truncate max-w-[140px] sm:max-w-[200px]">
                                {g.blackUsername}
                              </span>
                            ) : (
                              <Link
                                href={`/profile/${g.blackUsername}`}
                                className="font-semibold text-parchment-300 hover:underline hover:text-brass-300 transition-colors truncate max-w-[140px] sm:max-w-[200px]"
                              >
                                {g.blackUsername}
                              </Link>
                            )}
                            <span className="text-xs font-mono text-parchment-400 font-medium">
                              ({g.blackRating})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Result Pill, Termination & Date */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-wood-800">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wide ${
                              userWon
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : draw
                                ? 'bg-wood-800 text-parchment-300 border border-wood-700'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {outcomeText} ({g.result})
                          </span>
                        </div>

                        <div className="text-xs text-parchment-400 flex sm:flex-col items-center sm:items-end gap-1.5 sm:gap-0.5">
                          <span className="text-parchment-300 font-semibold">{terminationLabel}</span>
                          <span className="text-parchment-500 text-[11px]">
                            {g.movesCount} moves • {formatDate(g.playedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-wood-800">
                <button
                  onClick={() => setGamesPage((p) => Math.max(1, p - 1))}
                  disabled={gamesPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-wood-950 hover:bg-wood-850 border border-wood-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-parchment-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isCurrent = pageNum === gamesPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setGamesPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-brass-500 text-wood-950 shadow'
                            : 'bg-wood-950 text-parchment-400 hover:bg-wood-850 hover:text-parchment-200 border border-wood-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setGamesPage((p) => Math.min(totalPages, p + 1))}
                  disabled={gamesPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-wood-950 hover:bg-wood-850 border border-wood-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-parchment-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'stats' && (() => {
        const totalGames = games.length;
        const wins = games.filter((g) => (g.whiteUserId === profile.id && g.result === '1-0') || (g.blackUserId === profile.id && g.result === '0-1')).length;
        const losses = games.filter((g) => (g.whiteUserId === profile.id && g.result === '0-1') || (g.blackUserId === profile.id && g.result === '1-0')).length;
        const draws = games.filter((g) => g.result === '1/2-1/2').length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const drawRate = totalGames > 0 ? Math.round((draws / totalGames) * 100) : 0;
        const lossRate = totalGames > 0 ? 100 - winRate - drawRate : 0;

        const whiteGames = games.filter((g) => g.whiteUserId === profile.id);
        const blackGames = games.filter((g) => g.blackUserId === profile.id);
        const whiteWins = whiteGames.filter((g) => g.result === '1-0').length;
        const blackWins = blackGames.filter((g) => g.result === '0-1').length;
        const whiteWinPct = whiteGames.length > 0 ? Math.round((whiteWins / whiteGames.length) * 100) : 0;
        const blackWinPct = blackGames.length > 0 ? Math.round((blackWins / blackGames.length) * 100) : 0;

        const peakRating = Math.max(ratings.rapid, ratings.blitz, ratings.bullet, 200);

        return (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Top Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex flex-col gap-1">
                <span className="text-[10px] font-serif uppercase tracking-wider text-parchment-400 font-bold">Total Matches</span>
                <span className="text-2xl font-mono font-bold text-parchment-100">{totalGames}</span>
                <span className="text-[10px] text-parchment-500 font-mono">Player vs Player</span>
              </div>

              <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex flex-col gap-1">
                <span className="text-[10px] font-serif uppercase tracking-wider text-parchment-400 font-bold">Win Rate</span>
                <span className="text-2xl font-mono font-bold text-emerald-400">{winRate}%</span>
                <span className="text-[10px] text-parchment-500 font-mono">{wins}W • {draws}D • {losses}L</span>
              </div>

              <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex flex-col gap-1">
                <span className="text-[10px] font-serif uppercase tracking-wider text-parchment-400 font-bold">Peak Rating</span>
                <span className="text-2xl font-mono font-bold text-brass-400">{peakRating}</span>
                <span className="text-[10px] text-parchment-500 font-mono">All Time High</span>
              </div>

              <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex flex-col gap-1">
                <span className="text-[10px] font-serif uppercase tracking-wider text-parchment-400 font-bold">Best Discipline</span>
                <span className="text-2xl font-serif font-bold text-parchment-100">
                  {ratings.rapid >= ratings.blitz && ratings.rapid >= ratings.bullet ? 'Rapid' : ratings.blitz >= ratings.bullet ? 'Blitz' : 'Bullet'}
                </span>
                <span className="text-[10px] text-brass-400 font-mono">{peakRating} Elo</span>
              </div>
            </div>

            {/* Match Outcomes Breakdown & Proportions */}
            <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-brass-400" />
                  <span>Match Outcomes</span>
                </h3>
                <span className="text-xs font-mono text-parchment-400">
                  {totalGames} Completed Games
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 rounded-full bg-wood-950 overflow-hidden flex shadow-inner">
                {totalGames === 0 ? (
                  <div className="w-full h-full bg-wood-800" />
                ) : (
                  <>
                    <div style={{ width: `${winRate}%` }} className="bg-emerald-500 h-full transition-all" title={`Wins: ${winRate}%`} />
                    <div style={{ width: `${drawRate}%` }} className="bg-amber-500 h-full transition-all" title={`Draws: ${drawRate}%`} />
                    <div style={{ width: `${lossRate}%` }} className="bg-rose-500 h-full transition-all" title={`Losses: ${lossRate}%`} />
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-3 rounded-xl bg-wood-950 border border-wood-800">
                  <span className="text-emerald-400 font-mono font-bold text-lg block">{wins}</span>
                  <span className="text-[10px] uppercase font-serif tracking-wider text-parchment-400">Wins ({winRate}%)</span>
                </div>
                <div className="p-3 rounded-xl bg-wood-950 border border-wood-800">
                  <span className="text-amber-400 font-mono font-bold text-lg block">{draws}</span>
                  <span className="text-[10px] uppercase font-serif tracking-wider text-parchment-400">Draws ({drawRate}%)</span>
                </div>
                <div className="p-3 rounded-xl bg-wood-950 border border-wood-800">
                  <span className="text-rose-400 font-mono font-bold text-lg block">{losses}</span>
                  <span className="text-[10px] uppercase font-serif tracking-wider text-parchment-400">Losses ({lossRate}%)</span>
                </div>
              </div>
            </div>

            {/* Side-by-Side: Performance by Color & Rating Systems */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Performance by Color */}
              <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-brass-400" />
                  <span>Performance by Piece Color</span>
                </h3>

                <div className="flex flex-col gap-3">
                  <div className="p-3.5 rounded-xl bg-wood-950 border border-wood-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-parchment-100 shadow border border-wood-600" />
                      <div>
                        <span className="text-xs font-serif font-bold text-parchment-100 block">Playing White</span>
                        <span className="text-[10px] text-parchment-500 font-mono">{whiteGames.length} games played</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400 block">{whiteWinPct}%</span>
                      <span className="text-[10px] text-parchment-500">{whiteWins} won</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-wood-950 border border-wood-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-wood-950 border border-brass-500/40" />
                      <div>
                        <span className="text-xs font-serif font-bold text-parchment-100 block">Playing Black</span>
                        <span className="text-[10px] text-parchment-500 font-mono">{blackGames.length} games played</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400 block">{blackWinPct}%</span>
                      <span className="text-[10px] text-parchment-500">{blackWins} won</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rating Disciplines */}
              <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
                  <BlitzIcon className="w-4 h-4" />
                  <span>Rating Disciplines</span>
                </h3>

                <div className="flex flex-col divide-y divide-wood-800 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RapidIcon className="w-4 h-4" />
                      <span className="text-parchment-300 font-medium">Rapid (10+ min)</span>
                    </div>
                    <span className="font-mono font-bold text-parchment-100">{ratings.rapid}</span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BlitzIcon className="w-4 h-4" />
                      <span className="text-parchment-300 font-medium">Blitz (3-5 min)</span>
                    </div>
                    <span className="font-mono font-bold text-parchment-100">{ratings.blitz}</span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BulletIcon className="w-4 h-4" />
                      <span className="text-parchment-300 font-medium">Bullet (1 min)</span>
                    </div>
                    <span className="font-mono font-bold text-parchment-100">{ratings.bullet}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fadeIn backdrop-blur-sm">
          <div className="w-full max-w-md bg-wood-900 border border-brass-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-parchment-100 text-sm">Edit Profile</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-parchment-400 hover:text-parchment-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-parchment-300 uppercase tracking-wider">
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  placeholder="Tell others about your chess journey..."
                  className="w-full px-3 py-2 rounded-xl custom-input text-xs text-parchment-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-parchment-300 uppercase tracking-wider">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 rounded-xl custom-input text-xs text-parchment-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-wood-800 text-xs font-semibold text-parchment-400 hover:text-parchment-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-brass-600 hover:bg-brass-500 text-wood-950 text-xs font-bold transition-all shadow cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

