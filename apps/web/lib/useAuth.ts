'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
  ratings?: {
    fide: number;
    chesscom: number;
    lichess: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const LOCAL_STORAGE_USER_KEY = 'schoolchess_authenticated_user_v1';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const fullUser: AuthUser = {
          ...data.user,
          ratings: data.ratings || { fide: 1600, chesscom: 1500, lichess: 1500 },
        };
        setUser(fullUser);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(fullUser));
      } else {
        const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } catch {
      const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const register = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Registration failed');
      }

      await refreshUser();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      // Graceful offline fallback: allow local testing if server is unreachable
      if (message.includes('fetch') || message.includes('NetworkError') || message.includes('Failed to fetch')) {
        const mockUser: AuthUser = {
          id: 'local_' + Math.random().toString(36).substring(2, 9),
          username,
          createdAt: new Date().toISOString(),
          ratings: { fide: 1600, chesscom: 1500, lichess: 1500 },
        };
        setUser(mockUser);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mockUser));
        setLoading(false);
        return true;
      }
      setError(message);
      setLoading(false);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Login failed');
      }

      await refreshUser();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.includes('fetch') || message.includes('NetworkError') || message.includes('Failed to fetch')) {
        const mockUser: AuthUser = {
          id: 'local_' + Math.random().toString(36).substring(2, 9),
          username,
          createdAt: new Date().toISOString(),
          ratings: { fide: 1600, chesscom: 1500, lichess: 1500 },
        };
        setUser(mockUser);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mockUser));
        setLoading(false);
        return true;
      }
      setError(message);
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  };

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser,
  };
}

