'use client';

import { useEffect } from 'react';
import { useAuth, LOCAL_STORAGE_TOKEN_KEY } from './useAuth';

import { getApiBaseUrl } from './config';

const API_BASE = getApiBaseUrl();

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let abortController = new AbortController();

    const startTunnel = () => {
      try {
        const token = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
        const url = new URL(`${API_BASE}/api/v1/presence/tunnel`);
        if (token) {
          url.searchParams.set('token', token);
        }
        eventSource = new EventSource(url.toString(), {
          withCredentials: true,
        });

        eventSource.onerror = () => {
          // If unauthenticated or connection drops, close to prevent infinite 401 retry loops
          stopTunnel();
        };
      } catch {
        // Ignore network failure
      }
    };

    const stopTunnel = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    // Use Web Locks so exactly 1 tab holds the presence tunnel even across 100 tabs
    if (typeof navigator !== 'undefined' && navigator.locks) {
      navigator.locks
        .request(
          `xchess_presence_leader_lock_${user.id}`,
          { signal: abortController.signal },
          async () => {
            startTunnel();
            return new Promise<void>((resolve) => {
              abortController.signal.addEventListener('abort', () => {
                stopTunnel();
                resolve();
              });
            });
          }
        )
        .catch(() => {});
    } else {
      startTunnel();
    }

    return () => {
      abortController.abort();
      stopTunnel();
    };
  }, [user?.id]);
}

