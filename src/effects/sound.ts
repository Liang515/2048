// 音效引擎：用 Web Audio API 即時合成，不需要外部音檔

interface Note {
  freq: number;
  start: number;
}

export class SoundEngine {
  muted: boolean;
  private ctx: AudioContext | null = null;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  private init(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private play(fn: (ctx: AudioContext, now: number) => void): void {
    if (this.muted) return;
    try {
      const ctx = this.init();
      fn(ctx, ctx.currentTime);
    } catch (e) {
      console.error(e);
    }
  }

  playSlide(): void {
    this.play((ctx, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    });
  }

  playMerge(): void {
    // C5, E5（大三度，悅耳和弦）
    const notes: Note[] = [
      { freq: 523.25, start: 0 },
      { freq: 659.25, start: 0.04 },
    ];
    this.play((ctx, now) => {
      for (const { freq, start } of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, now + start + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.15);
      }
    });
  }

  playGameOver(): void {
    // A3, C4, Eb4（悲傷的減三和弦）
    this.play((ctx, now) => {
      for (const freq of [220, 261.63, 311.13]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.75, now + 0.6);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    });
  }

  playVictory(): void {
    // C5 - E5 - G5 - C6 琶音
    const melody = [523.25, 659.25, 783.99, 1046.5];
    const duration = 0.15;
    this.play((ctx, now) => {
      melody.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.01);
        gain.gain.linearRampToValueAtTime(0.1, start + duration - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      });
    });
  }
}
