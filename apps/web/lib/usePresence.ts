'use client';

import { useEffect } from 'react';
import { useAuth } from './useAuth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let abortController = new AbortController();

    const startTunnel = () => {
      try {
        eventSource = new EventSource(`${API_BASE}/api/v1/presence/tunnel`, {
          withCredentials: true,
        });

        eventSource.onerror = () => {
          // If disconnected, let EventSource handle reconnect or retry after pause
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

