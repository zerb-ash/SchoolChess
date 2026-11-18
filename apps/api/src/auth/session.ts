import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface SessionData {
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export class SessionStore {
  private sessions = new Map<string, SessionData>();
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath ||
      process.env.SESSIONS_FILE_PATH ||
      path.resolve(process.cwd(), 'data', 'schoolchess_sessions.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (this.filePath === ':memory:') return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const [token, session] of Object.entries(parsed)) {
          const s = session as SessionData;
          if (s && s.expiresAt > now) {
            this.sessions.set(token, s);
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  private saveToDisk(): void {
    if (this.filePath === ':memory:') return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const obj = Object.fromEntries(this.sessions.entries());
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch {
      // Ignore
    }
  }

  public createSession(userId: string, username: string): string {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.sessions.set(rawToken, {
      userId,
      username,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    this.saveToDisk();
    return rawToken;
  }

  public getSession(token: string): SessionData | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      this.saveToDisk();
      return null;
    }
    return session;
  }

  public revokeSession(token: string): void {
    this.sessions.delete(token);
    this.saveToDisk();
  }
}

export const sessionStore = new SessionStore();
