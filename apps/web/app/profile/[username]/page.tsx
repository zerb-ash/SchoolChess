'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../lib/useAuth';
import {
  Gem,
  Calendar,
  Eye,
  Clock,
  Flame,
  Zap,
  Edit3,
  Check,
  X,
  Swords,
  Trophy,
  ShieldAlert,
  User,
  Radio,
} from 'lucide-react';

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
  blackUserId: string;
  blackUsername: string;
  blackRating: number;
  result: '1-0' | '0-1' | '1/2-1/2';
  termination: string;
  movesCount: number;
  accuracyWhite?: number;
  accuracyBlack?: number;
  playedAt: string;
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

  const { user: currentUser } = useAuth();

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

        // Record profile view
        fetch(`${API_BASE}/api/v1/users/${username}/view`, { method: 'POST' }).catch(() => {});
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
        const data = await res.json();
        setProfile((prev) => (prev ? { ...prev, bio: editBio, avatarUrl: editAvatarUrl } : null));
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
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header Profile Card */}
      <div className="bg-wood-900 border border-wood-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
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
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-sky-400" />
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-parchment-100">
                {profile.username}
              </h1>
              <span className="text-base">🇺🇸</span>
              <Gem className="w-4 h-4 text-sky-400" />
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
            {profile.bio || 'Chess enthusiast.'}
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
        <div className="flex flex-col gap-6">
          {/* Rating Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-wood-900 border border-wood-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-wood-950 border border-wood-800 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-400" />
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
                  <Flame className="w-5 h-5 text-amber-400" />
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
                  <Zap className="w-5 h-5 text-yellow-400" />
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

          {/* Game History (Players Only) */}
          <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            <h2 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300 flex items-center gap-2">
              <Swords className="w-4 h-4 text-brass-400" />
              <span>Game History (Player Matches)</span>
            </h2>

            {games.length === 0 ? (
              <div className="py-12 text-center text-xs text-parchment-500">
                No recorded player vs player games yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-wood-800">
                {games.map((g) => {
                  const isWhite = g.whiteUserId === profile.id;
                  const won = (isWhite && g.result === '1-0') || (!isWhite && g.result === '0-1');
                  const draw = g.result === '1/2-1/2';

                  return (
                    <div key={g.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-wood-950 flex items-center justify-center text-[10px] font-bold text-parchment-300">
                          {g.timeControl}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-parchment-200">
                            <span className="w-2.5 h-2.5 rounded-sm bg-parchment-100 border border-wood-700" />
                            <span>{g.whiteUsername}</span>
                            <span className="text-parchment-500 font-mono">({g.whiteRating})</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold text-parchment-300">
                            <span className="w-2.5 h-2.5 rounded-sm bg-wood-950 border border-brass-500/40" />
                            <span>{g.blackUsername}</span>
                            <span className="text-parchment-500 font-mono">({g.blackRating})</span>
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
          </div>
        </div>
      )}

      {activeTab === 'games' && (
        <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl">
          {games.length === 0 ? (
            <div className="py-12 text-center text-xs text-parchment-500">
              No rated player games recorded for @{profile.username}.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-wood-800">
              {games.map((g) => (
                <div key={g.id} className="py-3 flex items-center justify-between text-xs">
                  <span>{g.whiteUsername} vs {g.blackUsername}</span>
                  <span className="font-mono text-brass-400 font-bold">{g.result}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-wood-900 border border-wood-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
            <h3 className="text-xs font-serif font-bold uppercase tracking-wider text-parchment-300">
              Rating Progression
            </h3>
            <div className="flex items-center justify-between text-xs py-2 border-b border-wood-800">
              <span className="text-parchment-400">Peak Rapid</span>
              <span className="font-mono font-bold text-parchment-100">{ratings.rapid}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-2 border-b border-wood-800">
              <span className="text-parchment-400">Peak Blitz</span>
              <span className="font-mono font-bold text-parchment-100">{ratings.blitz}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-2">
              <span className="text-parchment-400">Peak Bullet</span>
              <span className="font-mono font-bold text-parchment-100">{ratings.bullet}</span>
            </div>
          </div>
        </div>
      )}

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
