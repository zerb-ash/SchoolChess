import crypto from 'node:crypto';

export interface SessionData {
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export class SessionStore {
  private sessions = new Map<string, SessionData>();

  public createSession(userId: string, username: string): string {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.sessions.set(rawToken, {
      userId,
      username,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    return rawToken;
  }

  public getSession(token: string): SessionData | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  public revokeSession(token: string): void {
    this.sessions.delete(token);
  }
}

export const sessionStore = new SessionStore();
