'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, User, Trophy, Calendar, Eye, Shield, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '../../lib/config';
import { OwnerBadge, isOwner } from '../../components/ui/OwnerBadge';

interface SearchUserResult {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  lastSeenAt: string;
  views: number;
  isOnline: boolean;
  rating: number;
  ratings: {
    fide: number;
    rapid: number;
    bullet: number;
  };
}

const API_BASE = getApiBaseUrl();

export default function FindPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<SearchUserResult[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`${API_BASE}/api/v1/users/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
        setTotal(0);
        setTotalPages(1);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, page]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-parchment-100 flex items-center gap-2.5">
          <Search className="w-6 h-6 text-brass-400" />
          <span>Find Players</span>
        </h1>
        <p className="text-xs text-parchment-400 mt-1">
          Search player profiles across the XChess network by username
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-brass-500/70" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing a username..."
          className="w-full pl-11 pr-10 py-3 rounded-xl bg-wood-900 border border-brass-500/30 text-parchment-100 placeholder:text-parchment-500 text-sm focus:outline-none focus:border-brass-400 shadow-inner transition-colors"
        />
        {loading && (
          <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-brass-400 animate-spin" />
        )}
      </div>

      {/* Search Results Summary */}
      <div className="flex items-center justify-between text-xs text-parchment-400 border-b border-wood-800 pb-2">
        <span>
          {loading ? 'Searching...' : `Found ${total} player${total === 1 ? '' : 's'}`}
        </span>
        {totalPages > 1 && (
          <span className="font-mono text-brass-400">Page {page} of {totalPages}</span>
        )}
      </div>

      {/* Results Grid */}
      {users.length === 0 && !loading ? (
        <div className="py-16 text-center flex flex-col items-center justify-center gap-2 bg-wood-900/50 border border-wood-800/80 rounded-2xl p-8">
          <User className="w-10 h-10 text-brass-500/40" />
          <p className="text-sm font-semibold text-parchment-200">No players found</p>
          <p className="text-xs text-parchment-500 max-w-xs">
            {debouncedQuery
              ? `No registered players matching "${debouncedQuery}". Try another keyword.`
              : 'Start typing in the search bar above to look up players.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {users.map((player) => {
            const joinDate = new Date(player.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            });

            const hasBio = player.bio && player.bio.trim() && player.bio.trim() !== 'No bio';
            const displayBio = hasBio ? `"${player.bio!.trim()}"` : '"No bio"';

            return (
              <Link
                key={player.id}
                href={`/profile/@${player.username}`}
                className="group relative flex items-center gap-4 p-4 rounded-2xl bg-wood-900 border border-wood-800 hover:border-brass-500/50 hover:bg-wood-850 transition-all shadow-md hover:shadow-xl min-h-[105px]"
              >
                {/* Big Avatar with Online Badge */}
                <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-wood-950 border-2 border-brass-500/40 flex items-center justify-center shrink-0 shadow-inner group-hover:border-brass-400 transition-colors">
                  {player.avatarUrl ? (
                    <img
                      src={player.avatarUrl}
                      alt={player.username}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="font-serif font-black text-2xl sm:text-3xl text-brass-400 select-none">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {player.isOnline && (
                    <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-wood-950 shadow" title="Online now" />
                  )}
                </div>

                {/* Uniform Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                  {/* Line 1: Username & ELO badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-serif font-bold text-base sm:text-lg text-parchment-100 group-hover:text-brass-300 transition-colors truncate">
                        {player.username}
                      </span>
                      {isOwner(player.username) && <OwnerBadge size="sm" />}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-wood-950 border border-wood-800 text-brass-400 font-mono font-bold shrink-0 shadow-inner">
                      {player.rating} ELO
                    </span>
                  </div>

                  {/* Line 2: Uniform Bio in quotes */}
                  <p className="text-xs text-parchment-400 italic truncate max-w-[260px] font-medium leading-none">
                    {displayBio}
                  </p>

                  {/* Line 3: Meta (Joined & Views) */}
                  <div className="flex items-center gap-3 text-[11px] text-parchment-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-parchment-600" />
                      Joined {joinDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-parchment-600" />
                      {player.views || 0} views
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-wood-800 text-xs text-parchment-400">
          <span>
            Showing {users.length} of {total} player{total === 1 ? '' : 's'}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-wood-700 bg-wood-900 text-xs font-semibold text-parchment-300 hover:text-parchment-100 hover:bg-wood-850 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-xs font-mono text-parchment-300 px-2 font-bold">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
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
