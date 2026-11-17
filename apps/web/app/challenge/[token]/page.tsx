'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Crown, Copy, Check, Users, Clock, Shield, Swords, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../lib/useAuth';

interface ChallengeInfo {
  id: string;
  token: string;
  shortCode: string;
  creatorId: string;
  creatorUsername: string;
  timeControl: string;
  side: 'white' | 'black' | 'random';
  rated: boolean;
  status: 'open' | 'accepted' | 'cancelled' | 'expired';
  gameId?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { user } = useAuth();

  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const fetchChallenge = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/challenges/${token}`);
      if (!res.ok) {
        throw new Error('Challenge not found or expired');
      }
      const data = await res.json();
      setChallenge(data.challenge);

      if (data.challenge.status === 'accepted' && data.challenge.gameId) {
        router.push(`/game/${data.challenge.gameId}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load challenge');
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    fetchChallenge();
    const interval = setInterval(fetchChallenge, 1500);
    return () => clearInterval(interval);
  }, [fetchChallenge]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/challenges/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          username: user?.username || 'Challenger',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to accept challenge');
      }

      const data = await res.json();
      router.push(`/game/${data.gameId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error accepting challenge');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-parchment-300">
        <div className="w-8 h-8 border-2 border-brass-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl bg-wood-900 border border-wood-800 p-8 text-center text-parchment-200">
          <AlertCircle className="w-10 h-10 text-salon-crimson mx-auto mb-3" />
          <h2 className="text-xl font-serif text-parchment-100 mb-2">Challenge Unavailable</h2>
          <p className="text-xs text-parchment-400 mb-6">{error || 'This challenge does not exist.'}</p>
          <button
            onClick={() => router.push('/play')}
            className="px-5 py-2.5 rounded-lg bg-brass-600 text-wood-950 font-bold text-xs uppercase tracking-wider"
          >
            Return to Salon
          </button>
        </div>
      </div>
    );
  }

  const isCreator = user && user.id === challenge.creatorId;

  return (
    <div className="flex-1 max-w-xl mx-auto w-full px-4 py-12 flex flex-col items-center justify-center">
      <div
        className="w-full rounded-2xl bg-wood-900 border border-brass-500/30 p-8 shadow-2xl text-parchment-100 relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(197, 168, 88, 0.08) 0%, transparent 70%)',
        }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-wood-850 border border-brass-500/40 flex items-center justify-center mb-3 shadow-inner">
            <Swords className="w-7 h-7 text-brass-400" />
          </div>
          <h1 className="text-2xl font-serif tracking-wide text-parchment-100">
            {isCreator ? 'Private Salon Invitation' : 'Chess Challenge Received'}
          </h1>
          <p className="text-xs text-parchment-400 mt-1">
            Issued by <span className="font-semibold text-brass-300">{challenge.creatorUsername}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-6 text-center">
          <div className="p-3 rounded-xl bg-wood-950 border border-wood-800">
            <Clock className="w-4 h-4 text-brass-400 mx-auto mb-1" />
            <div className="text-[10px] uppercase tracking-wider text-parchment-500 font-mono">Time</div>
            <div className="text-sm font-bold text-parchment-100 font-mono">{challenge.timeControl}</div>
          </div>
          <div className="p-3 rounded-xl bg-wood-950 border border-wood-800">
            <Users className="w-4 h-4 text-brass-400 mx-auto mb-1" />
            <div className="text-[10px] uppercase tracking-wider text-parchment-500 font-mono">Piece Color</div>
            <div className="text-sm font-bold text-parchment-100 capitalize">{challenge.side}</div>
          </div>
          <div className="p-3 rounded-xl bg-wood-950 border border-wood-800">
            <Shield className="w-4 h-4 text-brass-400 mx-auto mb-1" />
            <div className="text-[10px] uppercase tracking-wider text-parchment-500 font-mono">Status</div>
            <div className="text-sm font-bold text-brass-300 capitalize">{challenge.rated ? 'Rated' : 'Casual'}</div>
          </div>
        </div>

        {isCreator ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="p-4 rounded-xl bg-wood-950 border border-brass-500/20 flex flex-col items-center">
              <span className="text-[11px] uppercase tracking-widest text-parchment-400 mb-1">
                Classroom / Room Code
              </span>
              <div className="text-3xl font-mono font-bold tracking-widest text-brass-300 select-all my-1">
                {challenge.shortCode}
              </div>
              <span className="text-[10px] text-parchment-500">
                Opponents can enter this 6-character code in the Salon lobby
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? window.location.href : ''}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-wood-950 border border-wood-700 text-parchment-300 font-mono select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 rounded-lg bg-brass-600 hover:bg-brass-500 text-wood-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-2.5 text-xs text-brass-400 pt-2 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-brass-400" />
              <span>Awaiting opponent to take a seat at the board...</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-wood-950 font-bold text-sm tracking-wide shadow-lg shadow-brass-700/20 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
            >
              <span>{accepting ? 'Taking Seat...' : 'Accept Challenge & Play'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/play')}
              className="w-full py-2.5 rounded-xl bg-wood-950 hover:bg-wood-850 text-parchment-400 text-xs font-semibold border border-wood-800 transition-colors"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

