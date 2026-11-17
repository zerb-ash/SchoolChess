import { TabIpcMessage, TabRole, TabSyncOptions } from './types.js';
import { MoveSubmission, DrawAction, ResignPayload } from '@schoolchess/shared-types';

export class TabSocketManager {
  private tabId: string;
  private channelName: string;
  private wsUrl: string;
  private token?: string;
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private role: TabRole = 'candidate';
  private lockAbortController: AbortController | null = null;
  private yieldLockResolver: (() => void) | null = null;
  private activeSubscriptions = new Set<string>(); // gameIds this tab or follower tabs care about
  private options: TabSyncOptions;
  private isDestroyed = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(options: TabSyncOptions) {
    this.options = options;
    this.wsUrl = options.wsUrl;
    this.token = options.token;
    this.channelName = options.channelName || 'schoolchess_tab_bus';
    this.tabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab_${Math.random().toString(36).substring(2, 10)}`;

    if (typeof window !== 'undefined') {
      this.initChannel();
      this.startLeaderElection();
      this.setupVisibilityListener();
    }
  }

  public getRole(): TabRole {
    return this.role;
  }

  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Initializes inter-tab communication over BroadcastChannel
   */
  private initChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;

    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event: MessageEvent<TabIpcMessage>) => {
      this.handleIpcMessage(event.data);
    };

    window.addEventListener('beforeunload', () => {
      this.destroy();
    });
  }

  /**
   * Uses Web Locks API (navigator.locks) for sub-5ms OS/process level leader failover.
   */
  private startLeaderElection(): void {
    if (typeof navigator === 'undefined' || !navigator.locks) {
      // Fallback: If Web Locks unavailable, assume leader directly
      this.becomeLeader();
      return;
    }

    this.lockAbortController = new AbortController();

    navigator.locks.request(
      'schoolchess_ws_leader_lock',
      { signal: this.lockAbortController.signal },
      async () => {
        if (this.isDestroyed) return;
        
        // Lock acquired! This tab is now the LEADER!
        this.becomeLeader();

        // Hold the lock until yielded (handover or tab close)
        return new Promise<void>((resolve) => {
          this.yieldLockResolver = resolve;
        });
      }
    ).catch(() => {
      // Lock request aborted or failed
    });
  }

  /**
   * Transition this tab to LEADER role.
   */
  private becomeLeader(): void {
    this.role = 'leader';
    this.options.onRoleChange?.('leader');

    // Announce to all follower tabs
    this.broadcastIpc({
      type: 'LEADER_ANNOUNCE',
      leaderTabId: this.tabId,
      timestamp: Date.now(),
    });

    // Start leader heartbeat
    this.startHeartbeat();

    // Connect the single persistent WebSocket to backend
    this.connectWebSocket();
  }

  /**
   * Gracefully yields the leader lock (e.g. when user switches to another tab)
   */
  public yieldLeadership(targetTabId?: string): void {
    if (this.role !== 'leader') return;

    this.stopHeartbeat();
    this.closeWebSocket();
    this.role = 'candidate';
    this.options.onRoleChange?.('candidate');

    if (targetTabId) {
      this.broadcastIpc({
        type: 'HANDOVER_ACCEPTED',
        newLeaderTabId: targetTabId,
      });
    }

    if (this.yieldLockResolver) {
      this.yieldLockResolver();
      this.yieldLockResolver = null;
    }

    // Immediately re-queue for election as candidate
    setTimeout(() => {
      if (!this.isDestroyed && this.role === 'candidate') {
        this.startLeaderElection();
      }
    }, 10);
  }

  /**
   * Listen to tab visibility changes.
   * If this tab becomes visible while another tab is leader, request handover.
   */
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.role === 'candidate') {
        // Active tab requests leadership so timer isn't throttled in background
        this.broadcastIpc({
          type: 'HANDOVER_REQUEST',
          requesterTabId: this.tabId,
        });
      }
    });
  }

  /**
   * Establish persistent WebSocket connection (only runs on Leader tab).
   */
  private connectWebSocket(): void {
    if (typeof WebSocket === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const urlWithToken = this.token ? `${this.wsUrl}?token=${this.token}` : this.wsUrl;
    this.socket = new WebSocket(urlWithToken);

    this.socket.onopen = () => {
      this.broadcastIpc({ type: 'SERVER_CONNECTION_STATUS', isConnected: true });
      this.options.onConnectionChange?.(true);

      // Re-subscribe any active rooms
      for (const gameId of this.activeSubscriptions) {
        this.socketSend({ type: 'game:join', payload: { gameId } });
      }
    };

    this.socket.onclose = () => {
      this.broadcastIpc({ type: 'SERVER_CONNECTION_STATUS', isConnected: false });
      this.options.onConnectionChange?.(false);

      // Auto-reconnect if still leader
      if (this.role === 'leader' && !this.isDestroyed) {
        setTimeout(() => this.connectWebSocket(), 1500);
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch {
        // Ignore unparseable frames
      }
    };
  }

  private closeWebSocket(): void {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private socketSend(data: unknown): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  /**
   * Inter-tab IPC message router.
   */
  private handleIpcMessage(msg: TabIpcMessage): void {
    switch (msg.type) {
      case 'LEADER_ANNOUNCE':
        if (msg.leaderTabId !== this.tabId) {
          this.role = 'candidate';
          this.options.onRoleChange?.('candidate');
        }
        break;

      case 'HANDOVER_REQUEST':
        if (this.role === 'leader' && document?.visibilityState === 'hidden') {
          // Current leader is in background, yield to foreground requester!
          this.yieldLeadership(msg.requesterTabId);
        }
        break;

      case 'CLIENT_SUBSCRIBE':
        this.activeSubscriptions.add(msg.gameId);
        if (this.role === 'leader') {
          this.socketSend({ type: 'game:join', payload: { gameId: msg.gameId } });
        }
        break;

      case 'CLIENT_UNSUBSCRIBE':
        this.activeSubscriptions.delete(msg.gameId);
        break;

      case 'CLIENT_SEND_MOVE':
        if (this.role === 'leader') {
          this.socketSend({ type: 'game:move', payload: msg.payload });
        }
        break;

      case 'CLIENT_SEND_DRAW':
        if (this.role === 'leader') {
          this.socketSend({ type: 'game:draw_action', payload: msg.payload });
        }
        break;

      case 'CLIENT_SEND_RESIGN':
        if (this.role === 'leader') {
          this.socketSend({ type: 'game:resign', payload: msg.payload });
        }
        break;

      // Broadcasted events originating from Server
      case 'SERVER_MOVE_APPLIED':
        this.options.onMoveApplied?.(msg.payload);
        break;

      case 'SERVER_GAME_STATE':
        this.options.onStateUpdate?.(msg.payload);
        break;

      case 'SERVER_MOVE_REJECTED':
        this.options.onMoveRejected?.(msg.payload);
        break;

      case 'SERVER_GAME_OVER':
        this.options.onGameOver?.(msg.payload);
        break;

      case 'SERVER_CONNECTION_STATUS':
        this.options.onConnectionChange?.(msg.isConnected);
        break;
    }
  }

  /**
   * Distributes server messages to this tab and all follower tabs.
   */
  private handleServerMessage(msg: { type: string; payload: any }): void {
    switch (msg.type) {
      case 'game:state':
        this.options.onStateUpdate?.(msg.payload);
        this.broadcastIpc({ type: 'SERVER_GAME_STATE', payload: msg.payload });
        break;

      case 'game:move_applied':
        this.options.onMoveApplied?.(msg.payload);
        this.broadcastIpc({ type: 'SERVER_MOVE_APPLIED', payload: msg.payload });
        break;

      case 'game:move_rejected':
        this.options.onMoveRejected?.(msg.payload);
        this.broadcastIpc({ type: 'SERVER_MOVE_REJECTED', payload: msg.payload });
        break;

      case 'game:over':
        this.options.onGameOver?.(msg.payload);
        this.broadcastIpc({ type: 'SERVER_GAME_OVER', payload: msg.payload });
        break;
    }
  }

  // Public methods callable by React UI in ANY tab
  public subscribeGame(gameId: string): void {
    this.activeSubscriptions.add(gameId);
    if (this.role === 'leader') {
      this.socketSend({ type: 'game:join', payload: { gameId } });
    } else {
      this.broadcastIpc({ type: 'CLIENT_SUBSCRIBE', tabId: this.tabId, gameId });
    }
  }

  public joinGame(gameId: string): void {
    this.subscribeGame(gameId);
  }

  public disconnect(): void {
    this.destroy();
  }

  public sendMove(submission: MoveSubmission): void {
    if (this.role === 'leader') {
      this.socketSend({ type: 'game:move', payload: submission });
    } else {
      this.broadcastIpc({ type: 'CLIENT_SEND_MOVE', tabId: this.tabId, payload: submission });
    }
  }

  public sendDrawAction(action: DrawAction): void {
    if (this.role === 'leader') {
      this.socketSend({ type: 'game:draw_action', payload: action });
    } else {
      this.broadcastIpc({ type: 'CLIENT_SEND_DRAW', tabId: this.tabId, payload: action });
    }
  }

  public sendResign(resign: ResignPayload): void {
    if (this.role === 'leader') {
      this.socketSend({ type: 'game:resign', payload: resign });
    } else {
      this.broadcastIpc({ type: 'CLIENT_SEND_RESIGN', tabId: this.tabId, payload: resign });
    }
  }

  private broadcastIpc(message: TabIpcMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // Channel closed
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.role === 'leader') {
        this.broadcastIpc({
          type: 'LEADER_HEARTBEAT',
          leaderTabId: this.tabId,
          timestamp: Date.now(),
        });
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'client:ping', payload: { t: Date.now() } }));
        }
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.stopHeartbeat();
    this.closeWebSocket();

    if (this.yieldLockResolver) {
      this.yieldLockResolver();
      this.yieldLockResolver = null;
    }

    if (this.lockAbortController) {
      this.lockAbortController.abort();
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

