'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
  bio?: string;
  avatarUrl?: string;
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
        if (data.user) {
          let avatarUrl = data.user.avatarUrl || '';
          let bio = data.user.bio || 'No bio';
          try {
            const pRes = await fetch(`${API_BASE}/api/v1/users/${data.user.username}`);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.user?.avatarUrl) avatarUrl = pData.user.avatarUrl;
              if (pData.user?.bio) bio = pData.user.bio;
            }
          } catch {
            // Keep existing avatarUrl
          }

          const fullUser: AuthUser = {
            ...data.user,
            avatarUrl,
            bio,
            ratings: data.user.ratings || { fide: 200, chesscom: 200, lichess: 200 },
          };
          setUser(fullUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(fullUser));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: fullUser }));
          }
        } else {
          setUser(null);
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
      } else {
        const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (stored) {
          try {
            const parsed: AuthUser = JSON.parse(stored);
            if (parsed?.username) {
              try {
                const pRes = await fetch(`${API_BASE}/api/v1/users/${parsed.username}`);
                if (pRes.ok) {
                  const pData = await pRes.json();
                  if (pData.user?.avatarUrl) parsed.avatarUrl = pData.user.avatarUrl;
                  if (pData.user?.bio) parsed.bio = pData.user.bio;
                }
              } catch {
                // Keep parsed
              }
              setUser(parsed);
              localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(parsed));
            } else {
              setUser(null);
              localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            }
          } catch {
            setUser(null);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          }
        } else {
          setUser(null);
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
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

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated: AuthUser = { ...prev, ...partial };
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: updated }));
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    refreshUser();

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<AuthUser>;
      if (custom.detail) {
        setUser(custom.detail);
      } else {
        refreshUser();
      }
    };

    window.addEventListener('schoolchess_user_updated', handleUpdate);
    return () => {
      window.removeEventListener('schoolchess_user_updated', handleUpdate);
    };
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

      const data = await res.json();
      const newUser: AuthUser = {
        id: data.id,
        username: data.username,
        createdAt: data.createdAt,
        bio: 'No bio',
        avatarUrl: '',
        ratings: { fide: 200, chesscom: 200, lichess: 200 },
      };
      setUser(newUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUser));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: newUser }));
      }

      await refreshUser();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      if (message.includes('fetch') || message.includes('NetworkError') || message.includes('Failed to fetch')) {
        const mockUser: AuthUser = {
          id: 'local_' + Math.random().toString(36).substring(2, 9),
          username,
          createdAt: new Date().toISOString(),
          ratings: { fide: 200, chesscom: 200, lichess: 200 },
        };
        setUser(mockUser);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mockUser));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: mockUser }));
        }
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

      const data = await res.json();
      const loggedUser: AuthUser = {
        id: data.id,
        username: data.username,
        createdAt: data.createdAt,
        bio: data.bio || 'No bio',
        avatarUrl: data.avatarUrl || '',
        ratings: data.ratings || { fide: 200, chesscom: 200, lichess: 200 },
      };
      setUser(loggedUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(loggedUser));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: loggedUser }));
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
          ratings: { fide: 200, chesscom: 200, lichess: 200 },
        };
        setUser(mockUser);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mockUser));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: mockUser }));
        }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('schoolchess_user_updated', { detail: null }));
    }
  };

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    refreshUser,
    updateUser,
  };
}
