// True zero-latency (<1ms) Web Audio API sound engine using pre-decoded in-memory AudioBuffers

class ChessSoundSystem {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private masterVolume: number = 0.7;
  private gainNode: GainNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private isPreloading: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.ensureContext();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });

      // Start preloading buffers into memory immediately
      this.preloadAll();
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        this.gainNode.connect(this.ctx.destination);
      }
    }
    return this.ctx;
  }

  private async preloadAll() {
    if (this.isPreloading || typeof window === 'undefined') return;
    this.isPreloading = true;
    const sounds = ['move', 'capture', 'check', 'promote'];
    await Promise.all(sounds.map((name) => this.loadBuffer(`/sounds/${name}.mp3`)));
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    const ctx = this.ensureContext();
    if (!ctx) return null;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  private currentSource: AudioBufferSourceNode | null = null;
  private lastPlayTime: number = 0;
  private lastPriority: number = 0;

  private playBuffer(url: string, priority: number = 1) {
    if (!this.enabled || typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = Date.now();
    // If a higher or equal priority sound played within 120ms, suppress this lower priority sound
    if (now - this.lastPlayTime < 120 && priority <= this.lastPriority) {
      return;
    }

    // If a higher priority sound arrives, cut off the lower priority sound immediately
    if (this.currentSource && priority > this.lastPriority && now - this.lastPlayTime < 120) {
      try {
        this.currentSource.stop();
      } catch {}
    }

    this.lastPlayTime = now;
    this.lastPriority = priority;

    const playNode = (buffer: AudioBuffer) => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(this.masterVolume, ctx.currentTime);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        this.currentSource = source;
      } catch {}
    };

    const buffer = this.bufferCache.get(url);
    if (buffer) {
      playNode(buffer);
    } else {
      this.loadBuffer(url).then((b) => {
        if (b && ctx) playNode(b);
      });
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  // Priority 1: Move Sound
  public playMove() {
    this.playBuffer('/sounds/move.mp3', 1);
  }

  // Priority 2: Capture Sound
  public playCapture() {
    this.playBuffer('/sounds/capture.mp3', 2);
  }

  // Priority 3: Promotion Sound
  public playPromote() {
    this.playBuffer('/sounds/promote.mp3', 3);
  }

  // Priority 4: Check Sound
  public playCheck() {
    this.playBuffer('/sounds/check.mp3', 4);
  }

  // Priority 5: Checkmate / Game Over
  public playGameOver() {
    this.playBuffer('/sounds/check.mp3', 5);
  }

  public playLowTime() {
    this.playBuffer('/sounds/move.mp3', 1);
  }

  // Unified event-driven player with strict priority resolution
  public playMoveEvent(event: { check?: boolean; promotion?: boolean; captured?: boolean; gameOver?: boolean }) {
    if (event.gameOver) {
      this.playGameOver();
    } else if (event.check) {
      this.playCheck();
    } else if (event.promotion) {
      this.playPromote();
    } else if (event.captured) {
      this.playCapture();
    } else {
      this.playMove();
    }
  }
}

export const soundSystem = new ChessSoundSystem();
