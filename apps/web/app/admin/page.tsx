'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  Swords,
  Trophy,
  Server,
  Activity,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Calendar,
  Lock,
} from 'lucide-react';
import { useAuth, LOCAL_STORAGE_TOKEN_KEY } from '../../lib/useAuth';
import { getApiBaseUrl } from '../../lib/config';

const API_BASE = getApiBaseUrl();

interface AdminOverview {
  totalUsers: number;
  totalGames: number;
  onlineCount: number;
  onlineUsers: string[];
  runningGamesCount: number;
  challengesCount: number;
  matchmakingCount: number;
  system: {
    uptimeSeconds: number;
    memoryMb: number;
    nodeVersion: string;
  };
}

interface RunningGameItem {
  type: 'live_game' | 'challenge' | 'matchmaking';
  id: string;
  gameId?: string;
  white?: { id: string; username: string; rating?: number };
  black?: { id: string; username: string; rating?: number };
  creator?: { id: string; username: string };
  player?: { id: string; username: string; rating?: number };
  timeControl: string;
  status: string;
  moveNumber?: number;
  startedAt: number;
}

interface AdminUserItem {
  id: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  views: number;
  createdAt: string;
  lastSeenAt: string;
  isOnline: boolean;
  gamesCount: number;
  ratings: {
    fideBlitz: number;
    fideRapid: number;
    fideBullet: number;
  };
}

interface CompletedGameItem {
  id: string;
  timeControl: string;
  category: string;
  whiteUsername: string;
  whiteRating: number;
  blackUsername: string;
  blackRating: number;
  result: string;
  termination: string;
  movesCount: number;
  playedAt: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'users' | 'history'>('overview');

  // Overview data
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Running games data
  const [games, setGames] = useState<RunningGameItem[]>([]);
  const [gamesPage, setGamesPage] = useState(1);
  const [gamesTotalPages, setGamesTotalPages] = useState(1);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Users data
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // History data
  const [history, setHistory] = useState<CompletedGameItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) : null;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, []);

  // Fetch Overview
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/overview`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch {
      // Failed to load
    } finally {
      setOverviewLoading(false);
    }
  }, [getHeaders]);

  // Fetch Running Games
  const fetchGames = useCallback(async () => {
    setGamesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/games?page=${gamesPage}&limit=10`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setGames(data.games || []);
        setGamesTotal(data.total || 0);
        setGamesTotalPages(data.totalPages || 1);
      }
    } catch {
      // Failed to load
    } finally {
      setGamesLoading(false);
    }
  }, [gamesPage, getHeaders]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/admin/users?page=${usersPage}&limit=10&search=${encodeURIComponent(usersSearch)}`,
        {
          headers: getHeaders(),
          credentials: 'include',
        }
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUsersTotal(data.total || 0);
        setUsersTotalPages(data.totalPages || 1);
      }
    } catch {
      // Failed
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, usersSearch, getHeaders]);

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/history?page=${historyPage}&limit=10`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.games || []);
        setHistoryTotal(data.total || 0);
        setHistoryTotalPages(data.totalPages || 1);
      }
    } catch {
      // Failed
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, getHeaders]);

  useEffect(() => {
    if (user && user.username.toLowerCase() === 'admin') {
      if (activeTab === 'overview') fetchOverview();
      if (activeTab === 'games') fetchGames();
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'history') fetchHistory();
    }
  }, [activeTab, user, fetchOverview, fetchGames, fetchUsers, fetchHistory]);

  // Force terminate a game
  const handleForceEnd = async (gameId: string) => {
    if (!confirm(`Are you sure you want to forcefully end game: ${gameId}? This will free up memory and notify participants.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/games/${encodeURIComponent(gameId)}/terminate`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        setActionMessage(`Game ${gameId} successfully terminated.`);
        setTimeout(() => setActionMessage(null), 4000);
        fetchGames();
        fetchOverview();
      }
    } catch {
      alert('Failed to terminate game.');
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-xs text-parchment-500">
        Authenticating administrator session...
      </div>
    );
  }

  // Restrict access strictly to admin
  if (!user || user.username.toLowerCase() !== 'admin') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-salon-crimson/20 border border-salon-crimson/40 flex items-center justify-center shadow-lg">
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="font-serif font-bold text-xl text-parchment-100">Access Restricted</h1>
        <p className="text-xs text-parchment-400 max-w-sm">
          The XChess Admin Panel requires Owner or Administrator credentials. Please sign in with the <span className="text-brass-300 font-mono">admin</span> account to continue.
        </p>
        <Link
          href="/"
          className="mt-2 px-4 py-2 rounded-xl bg-wood-900 border border-wood-700 text-xs font-semibold text-parchment-200 hover:text-parchment-100 hover:bg-wood-850 transition-colors"
        >
          Return to Homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fadeIn">
      {/* Admin Title & Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-wood-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-brass-400" />
            <h1 className="text-2xl font-serif font-bold text-parchment-100 tracking-wide">
              XChess Administration
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brass-500/20 text-brass-300 border border-brass-500/30 uppercase tracking-widest font-bold">
              Owner
            </span>
          </div>
          <p className="text-xs text-parchment-400 mt-1">
            Real-time platform telemetry, game management, and memory resource control
          </p>
        </div>

        <button
          onClick={() => {
            if (activeTab === 'overview') fetchOverview();
            if (activeTab === 'games') fetchGames();
            if (activeTab === 'users') fetchUsers();
            if (activeTab === 'history') fetchHistory();
          }}
          className="px-3.5 py-1.5 rounded-xl border border-brass-500/30 bg-wood-900 hover:bg-wood-850 text-xs font-medium text-parchment-200 hover:text-parchment-100 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 text-brass-400" />
          <span>Refresh Data</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-wood-800 gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'overview', label: 'Overview & Metrics', icon: Activity },
          { id: 'games', label: `Live Online Games (${gamesTotal || overview?.runningGamesCount || 0})`, icon: Swords },
          { id: 'users', label: `Users (${usersTotal || overview?.totalUsers || 0})`, icon: Users },
          { id: 'history', label: `Completed Matches (${historyTotal || overview?.totalGames || 0})`, icon: Trophy },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-4 font-serif font-bold text-xs whitespace-nowrap border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-brass-400 text-brass-400 bg-wood-900/40 rounded-t-lg'
                  : 'border-transparent text-parchment-400 hover:text-parchment-200 hover:bg-wood-900/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-brass-500" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Metrics */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Top Metrics Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-wood-900 border border-wood-800 flex flex-col gap-1 shadow-md">
              <span className="text-[11px] text-parchment-500 uppercase tracking-wider font-semibold">Total Registered Users</span>
              <span className="text-2xl font-serif font-bold text-parchment-100">{overview?.totalUsers ?? '...'}</span>
              <span className="text-[10px] text-brass-400/80 mt-1">Platform player accounts</span>
            </div>
            <div className="p-4 rounded-xl bg-wood-900 border border-wood-800 flex flex-col gap-1 shadow-md">
              <span className="text-[11px] text-parchment-500 uppercase tracking-wider font-semibold">Online Players</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-serif font-bold text-emerald-400">{overview?.onlineCount ?? '...'}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <span className="text-[10px] text-parchment-500 mt-1">Active live connections</span>
            </div>
            <div className="p-4 rounded-xl bg-wood-900 border border-wood-800 flex flex-col gap-1 shadow-md">
              <span className="text-[11px] text-parchment-500 uppercase tracking-wider font-semibold">Active Running Games</span>
              <span className="text-2xl font-serif font-bold text-brass-300">{overview?.runningGamesCount ?? 0}</span>
              <span className="text-[10px] text-parchment-500 mt-1">Live WebSocket rooms</span>
            </div>
            <div className="p-4 rounded-xl bg-wood-900 border border-wood-800 flex flex-col gap-1 shadow-md">
              <span className="text-[11px] text-parchment-500 uppercase tracking-wider font-semibold">Completed Matches</span>
              <span className="text-2xl font-serif font-bold text-parchment-100">{overview?.totalGames ?? 0}</span>
              <span className="text-[10px] text-parchment-500 mt-1">Total recorded in DB</span>
            </div>
          </div>

          {/* System & Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-wood-900 border border-wood-800 flex flex-col gap-3 shadow-md">
              <div className="flex items-center gap-2 text-sm font-serif font-bold text-parchment-100">
                <Server className="w-4 h-4 text-brass-400" />
                <span>Backend Server Health</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-wood-950 border border-wood-850 flex flex-col">
                  <span className="text-[10px] text-parchment-500 uppercase">Uptime</span>
                  <span className="font-mono text-sm font-semibold text-brass-300">
                    {overview?.system.uptimeSeconds ? `${Math.floor(overview.system.uptimeSeconds / 60)} min` : '...'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-wood-950 border border-wood-850 flex flex-col">
                  <span className="text-[10px] text-parchment-500 uppercase">Memory RSS</span>
                  <span className="font-mono text-sm font-semibold text-brass-300">
                    {overview?.system.memoryMb ? `${overview.system.memoryMb} MB` : '...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Currently Online Users */}
            <div className="p-5 rounded-2xl bg-wood-900 border border-wood-800 flex flex-col gap-3 shadow-md">
              <div className="flex items-center gap-2 text-sm font-serif font-bold text-parchment-100">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Currently Connected Users ({overview?.onlineUsers?.length || 0})</span>
              </div>
              {overview?.onlineUsers && overview.onlineUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {overview.onlineUsers.map((name) => (
                    <span
                      key={name}
                      className="text-xs px-2.5 py-1 rounded-lg bg-wood-950 border border-wood-800 text-parchment-200 font-medium flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      @{name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-parchment-500">No users currently connected to the live tunnel.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Live Online Games */}
      {activeTab === 'games' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-parchment-400">
            <span>
              Active live games, open challenges, and queued players ({gamesTotal} total)
            </span>
            {gamesTotalPages > 1 && (
              <span>Page {gamesPage} of {gamesTotalPages}</span>
            )}
          </div>

          {gamesLoading ? (
            <div className="py-16 text-center text-xs text-parchment-500">Loading running games...</div>
          ) : games.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2 bg-wood-900 border border-wood-800 rounded-2xl p-6">
              <CheckCircle className="w-10 h-10 text-emerald-500/50" />
              <p className="text-sm font-semibold text-parchment-200">No suspended or active games</p>
              <p className="text-xs text-parchment-500 max-w-sm">
                Memory is clear. Active matchmaking, direct challenges, and live WebSocket games will appear here with instant termination control.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {games.map((g) => {
                const isRoom = g.type === 'live_game';
                const isChallenge = g.type === 'challenge';

                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl bg-wood-900 border border-wood-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isRoom
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : isChallenge
                              ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          {isRoom ? 'Live Match' : isChallenge ? 'Challenge' : 'Matchmaking Queue'}
                        </span>
                        <span className="font-mono text-xs text-parchment-400 truncate max-w-[200px]">
                          ID: {g.id}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-wood-950 text-brass-400 font-mono">
                          {g.timeControl}
                        </span>
                      </div>

                      {/* Players Info */}
                      <div className="text-xs text-parchment-200 flex items-center gap-3">
                        {isRoom && (
                          <>
                            <span className="font-semibold text-parchment-100">
                              White: <span className="text-brass-300">@{g.white?.username || 'Guest'}</span> ({g.white?.rating || 200})
                            </span>
                            <span className="text-parchment-500">vs</span>
                            <span className="font-semibold text-parchment-100">
                              Black: <span className="text-brass-300">@{g.black?.username || 'Guest'}</span> ({g.black?.rating || 200})
                            </span>
                            {g.moveNumber !== undefined && (
                              <span className="text-parchment-400 font-mono text-[11px]">
                                • Move #{g.moveNumber}
                              </span>
                            )}
                          </>
                        )}
                        {isChallenge && (
                          <span>
                            Creator: <span className="text-brass-300 font-semibold">@{g.creator?.username || 'Anonymous'}</span> (Code: {g.creator?.id || 'N/A'})
                          </span>
                        )}
                        {g.type === 'matchmaking' && (
                          <span>
                            Queued Player: <span className="text-brass-300 font-semibold">@{g.player?.username}</span> (Rating: {g.player?.rating})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Force End Action */}
                    <button
                      onClick={() => handleForceEnd(g.id)}
                      className="px-3 py-1.5 rounded-lg bg-salon-crimson/30 hover:bg-salon-crimson/50 border border-salon-crimson/60 text-red-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Force End Game</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {gamesTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-wood-800">
              <button
                onClick={() => setGamesPage((p) => Math.max(1, p - 1))}
                disabled={gamesPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-xs font-mono text-parchment-400 px-3">
                {gamesPage} / {gamesTotalPages}
              </span>
              <button
                onClick={() => setGamesPage((p) => Math.min(gamesTotalPages, p + 1))}
                disabled={gamesPage >= gamesTotalPages}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Users Management */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-parchment-500" />
              <input
                type="text"
                value={usersSearch}
                onChange={(e) => {
                  setUsersSearch(e.target.value);
                  setUsersPage(1);
                }}
                placeholder="Search user by name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-wood-900 border border-wood-700 text-xs text-parchment-100 placeholder:text-parchment-500 focus:outline-none focus:border-brass-400"
              />
            </div>
            <span className="text-xs text-parchment-400 self-end sm:self-center">
              Total {usersTotal} user{usersTotal === 1 ? '' : 's'}
            </span>
          </div>

          {usersLoading ? (
            <div className="py-16 text-center text-xs text-parchment-500">Loading user directory...</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-xs text-parchment-500 bg-wood-900 rounded-2xl border border-wood-800">
              No users matching search.
            </div>
          ) : (
            <div className="bg-wood-900 border border-wood-800 rounded-2xl overflow-x-auto shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-wood-950 border-b border-wood-800 text-parchment-400 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-4">Blitz ELO</th>
                    <th className="py-3 px-4">Rapid ELO</th>
                    <th className="py-3 px-4">Games</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wood-800/60 font-medium">
                  {users.map((u) => {
                    const joined = new Date(u.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <tr key={u.id} className="hover:bg-wood-850/50 transition-colors">
                        <td className="py-3 px-4">
                          <Link href={`/profile/@${u.username}`} className="flex items-center gap-2.5 group">
                            <div className="relative w-7 h-7 rounded-full bg-wood-950 border border-brass-500/40 flex items-center justify-center font-bold text-brass-400 text-xs overflow-hidden">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                u.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-semibold text-parchment-100 group-hover:text-brass-300 transition-colors">
                              @{u.username}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-brass-400">{u.ratings.fideBlitz}</td>
                        <td className="py-3 px-4 font-mono text-parchment-300">{u.ratings.fideRapid}</td>
                        <td className="py-3 px-4 font-mono text-parchment-400">{u.gamesCount}</td>
                        <td className="py-3 px-4 text-parchment-400">{joined}</td>
                        <td className="py-3 px-4">
                          {u.isOnline ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                              Online
                            </span>
                          ) : (
                            <span className="text-[10px] text-parchment-500">Offline</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Users Pagination */}
          {usersTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-wood-800">
              <button
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                disabled={usersPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-xs font-mono text-parchment-400 px-3">
                {usersPage} / {usersTotalPages}
              </span>
              <button
                onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                disabled={usersPage >= usersTotalPages}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Completed Matches History */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-parchment-400">
            <span>Completed game records ({historyTotal} recorded matches)</span>
            {historyTotalPages > 1 && (
              <span>Page {historyPage} of {historyTotalPages}</span>
            )}
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-xs text-parchment-500">Loading match history...</div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-xs text-parchment-500 bg-wood-900 rounded-2xl border border-wood-800">
              No completed online games yet.
            </div>
          ) : (
            <div className="bg-wood-900 border border-wood-800 rounded-2xl overflow-x-auto shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-wood-950 border-b border-wood-800 text-parchment-400 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Game</th>
                    <th className="py-3 px-4">Time Control</th>
                    <th className="py-3 px-4">White Player</th>
                    <th className="py-3 px-4">Black Player</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">Moves</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wood-800/60 font-medium">
                  {history.map((h) => {
                    const playedDate = new Date(h.playedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={h.id} className="hover:bg-wood-850/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-parchment-400 truncate max-w-[120px]">{h.id}</td>
                        <td className="py-3 px-4 font-mono font-bold text-brass-400">{h.timeControl}</td>
                        <td className="py-3 px-4 text-parchment-200">
                          @{h.whiteUsername} ({h.whiteRating})
                        </td>
                        <td className="py-3 px-4 text-parchment-200">
                          @{h.blackUsername} ({h.blackRating})
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              h.result === '1-0'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                                : h.result === '0-1'
                                ? 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                                : 'bg-wood-800 text-parchment-300'
                            }`}
                          >
                            {h.result} ({h.termination})
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-parchment-400">{h.movesCount || 0}</td>
                        <td className="py-3 px-4 text-parchment-400">{playedDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* History Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-wood-800">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-xs font-mono text-parchment-400 px-3">
                {historyPage} / {historyTotalPages}
              </span>
              <button
                onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                disabled={historyPage >= historyTotalPages}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
