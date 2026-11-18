import { MoveSubmission, DrawAction, ResignPayload, MoveAppliedEvent, GameStateEvent } from '@schoolchess/shared-types';

export type TabIpcMessage =
  | { type: 'LEADER_ANNOUNCE'; leaderTabId: string; timestamp: number }
  | { type: 'LEADER_HEARTBEAT'; leaderTabId: string; timestamp: number }
  | { type: 'HANDOVER_REQUEST'; requesterTabId: string }
  | { type: 'HANDOVER_ACCEPTED'; newLeaderTabId: string }
  | { type: 'CLIENT_SUBSCRIBE'; tabId: string; gameId: string; preferredColor?: 'white' | 'black' }
  | { type: 'CLIENT_UNSUBSCRIBE'; tabId: string; gameId: string }
  | { type: 'CLIENT_SEND_MOVE'; tabId: string; payload: MoveSubmission }
  | { type: 'CLIENT_SEND_DRAW'; tabId: string; payload: DrawAction }
  | { type: 'CLIENT_SEND_RESIGN'; tabId: string; payload: ResignPayload }
  | { type: 'SERVER_MOVE_APPLIED'; payload: MoveAppliedEvent }
  | { type: 'SERVER_GAME_STATE'; payload: GameStateEvent }
  | { type: 'SERVER_MOVE_REJECTED'; payload: { expectedMoveNumber: number; errorCode: string; currentFen: string } }
  | { type: 'SERVER_GAME_OVER'; payload: { gameId: string; result: string; termination: string; winnerId?: string } }
  | { type: 'SERVER_DRAW_OFFERED'; payload: { fromColor: 'w' | 'b' } }
  | { type: 'SERVER_DRAW_DECLINED'; payload: { byColor: 'w' | 'b' } }
  | { type: 'SERVER_PRESENCE'; payload: { whiteConnected: boolean; blackConnected: boolean } }
  | { type: 'SERVER_CONNECTION_STATUS'; isConnected: boolean };

export type TabRole = 'leader' | 'candidate';

export interface TabSyncOptions {
  channelName?: string;
  wsUrl: string;
  token?: string;
  userId?: string;
  onStateUpdate?: (state: GameStateEvent) => void;
  onMoveApplied?: (move: MoveAppliedEvent) => void;
  onMoveRejected?: (error: { expectedMoveNumber: number; errorCode: string; currentFen: string }) => void;
  onGameOver?: (data: { gameId: string; result: string; termination: string; winnerId?: string }) => void;
  onDrawOffered?: (data: { fromColor: 'w' | 'b' }) => void;
  onDrawDeclined?: (data: { byColor: 'w' | 'b' }) => void;
  onPresenceChange?: (data: { whiteConnected: boolean; blackConnected: boolean }) => void;
  onConnectionChange?: (connected: boolean) => void;
  onRoleChange?: (role: TabRole) => void;
}

