'use client';

import React, { useState } from 'react';
import { X, Crown, ArrowRight, AlertCircle, Lock, User } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'register',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, register, error: authError } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedUser = username.trim();
    if (/\s/.test(username)) {
      setLocalError('Username cannot contain spaces.');
      return;
    }
    if (trimmedUser.length < 3 || trimmedUser.length > 20) {
      setLocalError('Username must be between 3 and 20 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmedUser)) {
      setLocalError('Username can only contain letters and numbers (no special characters or spaces).');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }
    if (password.length > 72) {
      setLocalError('Password cannot exceed 72 characters.');
      return;
    }

    setSubmitting(true);
    let ok = false;
    if (mode === 'register') {
      ok = await register(trimmedUser, password);
    } else {
      ok = await login(trimmedUser, password);
    }
    setSubmitting(false);

    if (ok) {
      onClose();
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md rounded-2xl bg-wood-900 border border-brass-500/30 p-6 sm:p-8 shadow-2xl shadow-black/80 text-parchment-100"
        style={{
          backgroundImage: 'radial-gradient(circle at top, rgba(197, 168, 88, 0.08) 0%, transparent 70%)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-parchment-400 hover:text-parchment-100 hover:bg-wood-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-wood-850 border border-brass-500/40 flex items-center justify-center shadow-inner mb-3">
            <Crown className="w-6 h-6 text-brass-400" />
          </div>
          <h2 className="text-2xl font-serif tracking-wide text-parchment-100">
            {mode === 'register' ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-xs text-parchment-400 mt-1 max-w-xs">
            {mode === 'register'
              ? 'Choose a username and password to start playing rated games.'
              : 'Enter your credentials to continue your games.'}
          </p>
        </div>

        <div className="flex rounded-lg bg-wood-950 p-1 mb-6 border border-wood-800">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setLocalError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mode === 'register'
                ? 'bg-brass-500 text-wood-950 shadow'
                : 'text-parchment-400 hover:text-parchment-200'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLocalError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mode === 'login'
                ? 'bg-brass-500 text-wood-950 shadow'
                : 'text-parchment-400 hover:text-parchment-200'
            }`}
          >
            Sign In
          </button>
        </div>

        {displayedError && (
          <div className="mb-4 p-3 rounded-lg bg-salon-crimson/20 border border-salon-crimson/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{displayedError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-parchment-300 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-parchment-500" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                  setUsername(cleaned);
                  if (localError) setLocalError(null);
                }}
                placeholder="Letters and numbers only"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg custom-input text-sm text-parchment-100 placeholder:text-parchment-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-parchment-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-parchment-500" />
              <input
                type="password"
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 - 72 characters"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg custom-input text-sm text-parchment-100 placeholder:text-parchment-500 transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brass-600 to-brass-500 hover:from-brass-500 hover:to-brass-400 text-wood-950 font-bold text-sm tracking-wide shadow-lg shadow-brass-700/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{submitting ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
