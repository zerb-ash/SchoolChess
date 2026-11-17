export class AuthoritativeClock {
  private whiteRemainingMs: number;
  private blackRemainingMs: number;
  private incrementMs: number;
  private activeColor: 'w' | 'b' = 'w';
  private lastMoveTimestampNs: bigint | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private onTimeoutCallback: (loser: 'w' | 'b') => void;
  private isUntimed: boolean;

  constructor(
    initialTimeMs: number,
    incrementMs: number,
    onTimeout: (loser: 'w' | 'b') => void
  ) {
    this.whiteRemainingMs = initialTimeMs;
    this.blackRemainingMs = initialTimeMs;
    this.incrementMs = incrementMs;
    this.onTimeoutCallback = onTimeout;
    this.isUntimed = initialTimeMs <= 0;
  }

  public start(): void {
    if (this.isUntimed) return;
    this.lastMoveTimestampNs = process.hrtime.bigint();
    this.scheduleTimeout();
  }

  public recordMove(expectedColor: 'w' | 'b'): { whiteMs: number; blackMs: number } {
    if (this.isUntimed) {
      this.activeColor = expectedColor === 'w' ? 'b' : 'w';
      return { whiteMs: 0, blackMs: 0 };
    }

    const nowNs = process.hrtime.bigint();
    if (this.lastMoveTimestampNs !== null) {
      const elapsedMs = Number((nowNs - this.lastMoveTimestampNs) / 1_000_000n);

      if (expectedColor === 'w') {
        this.whiteRemainingMs = Math.max(0, this.whiteRemainingMs - elapsedMs + this.incrementMs);
      } else {
        this.blackRemainingMs = Math.max(0, this.blackRemainingMs - elapsedMs + this.incrementMs);
      }
    }

    this.activeColor = expectedColor === 'w' ? 'b' : 'w';
    this.lastMoveTimestampNs = nowNs;
    this.scheduleTimeout();

    return {
      whiteMs: Math.round(this.whiteRemainingMs),
      blackMs: Math.round(this.blackRemainingMs),
    };
  }

  private scheduleTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.isUntimed) return;

    const remainingMs = this.activeColor === 'w' ? this.whiteRemainingMs : this.blackRemainingMs;
    if (remainingMs <= 0) {
      this.onTimeoutCallback(this.activeColor);
      return;
    }

    this.timeoutTimer = setTimeout(() => {
      this.onTimeoutCallback(this.activeColor);
    }, remainingMs);
  }

  public getSnapshot(): { whiteMs: number; blackMs: number; activeColor: 'w' | 'b' } {
    if (this.isUntimed) {
      return { whiteMs: 0, blackMs: 0, activeColor: this.activeColor };
    }

    let w = this.whiteRemainingMs;
    let b = this.blackRemainingMs;

    if (this.lastMoveTimestampNs !== null) {
      const nowNs = process.hrtime.bigint();
      const elapsedMs = Number((nowNs - this.lastMoveTimestampNs) / 1_000_000n);
      if (this.activeColor === 'w') {
        w = Math.max(0, w - elapsedMs);
      } else {
        b = Math.max(0, b - elapsedMs);
      }
    }

    return {
      whiteMs: Math.round(w),
      blackMs: Math.round(b),
      activeColor: this.activeColor,
    };
  }

  public stop(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}

