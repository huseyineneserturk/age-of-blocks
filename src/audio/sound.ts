// Procedural Web Audio SFX, ported from v1 (legacy/src/SoundManager.js).
// Rate-limited per sound type + capped concurrency.

export type SoundType =
  | 'hit' | 'death' | 'arrow' | 'magic' | 'explosion'
  | 'select' | 'click' | 'build' | 'spawn' | 'resource'
  | 'victory' | 'defeat';

const COOLDOWNS: Partial<Record<SoundType, number>> = {
  hit: 40,
  death: 100,
  arrow: 60,
  magic: 90,
  explosion: 120,
  select: 60,
  spawn: 80,
  build: 100,
  resource: 200,
};

export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master = 0.3;
  private sfx = 0.4;
  private lastPlay = new Map<SoundType, number>();
  private active = 0;
  private readonly maxConcurrent = 8;

  /** Call once after the first user gesture. */
  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      console.warn('Web Audio API not supported');
    }
  }

  play(type: SoundType): void {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    const now = Date.now();
    const last = this.lastPlay.get(type) ?? 0;
    if (now - last < (COOLDOWNS[type] ?? 50)) return;
    this.lastPlay.set(type, now);

    if (this.active >= this.maxConcurrent) return;
    this.active++;
    setTimeout(() => {
      this.active = Math.max(0, this.active - 1);
    }, 300);

    const t = this.ctx.currentTime;
    switch (type) {
      case 'hit': this.hit(t); break;
      case 'death': this.death(t); break;
      case 'arrow': this.arrow(t); break;
      case 'magic': this.magic(t); break;
      case 'explosion': this.explosion(t); break;
      case 'select': this.select(t); break;
      case 'click': this.click(t); break;
      case 'build': this.build(t); break;
      case 'spawn': this.spawn(t); break;
      case 'resource': this.resource(t); break;
      case 'victory': this.victory(t); break;
      case 'defeat': this.defeat(t); break;
    }
  }

  private gainNode(volume: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = volume * this.master * this.sfx;
    g.connect(this.ctx!.destination);
    return g;
  }

  private osc(
    type: OscillatorType,
    f0: number,
    f1: number,
    start: number,
    dur: number,
    vol: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = this.gainNode(vol);
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    g.gain.setValueAtTime(vol * this.sfx, start);
    g.gain.exponentialRampToValueAtTime(0.01, start + dur);
    o.connect(g);
    o.start(start);
    o.stop(start + dur);
  }

  private noise(start: number, dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(f0, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    const g = this.gainNode(vol);
    g.gain.setValueAtTime(vol * this.sfx, start);
    g.gain.exponentialRampToValueAtTime(0.01, start + dur);
    src.connect(filter);
    filter.connect(g);
    src.start(start);
    src.stop(start + dur);
  }

  private hit(t: number): void {
    this.osc('sawtooth', 150 + Math.random() * 50, 50, t, 0.1, 0.2);
  }

  private death(t: number): void {
    this.noise(t, 0.3, 0.3, 'lowpass', 1000, 100);
  }

  private arrow(t: number): void {
    this.noise(t, 0.15, 0.1, 'highpass', 2000, 500);
  }

  private magic(t: number): void {
    this.osc('sine', 500, 1200, t, 0.18, 0.16);
    this.osc('triangle', 900, 300, t + 0.05, 0.25, 0.12);
  }

  private explosion(t: number): void {
    this.noise(t, 0.4, 0.35, 'lowpass', 800, 60);
  }

  private select(t: number): void {
    this.osc('sine', 400, 600, t, 0.1, 0.12);
  }

  private click(t: number): void {
    this.osc('sine', 800, 400, t, 0.05, 0.1);
  }

  private build(t: number): void {
    this.osc('square', 200, 100, t, 0.15, 0.3);
    this.osc('square', 180, 90, t + 0.08, 0.17, 0.2);
  }

  private spawn(t: number): void {
    this.osc('sine', 300, 600, t, 0.2, 0.15);
  }

  private resource(t: number): void {
    this.osc('sine', 1200, 1600, t, 0.15, 0.1);
  }

  private victory(t: number): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.osc('square', f, f, t + i * 0.15, 0.4, 0.2);
    });
  }

  private defeat(t: number): void {
    [392, 349.23, 293.66, 261.63].forEach((f, i) => {
      this.osc('sine', f, f, t + i * 0.2, 0.5, 0.15);
    });
  }
}
