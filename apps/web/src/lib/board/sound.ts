import type { SoundType } from './types';

interface ModalSpec {
  ratio: number;
  q: number;
  gain: number;
}

interface ExciterSpec {
  duration: number;
  filterHz: number;
}

interface AttackSpec {
  duration: number;
  filterHz: number;
  q: number;
  gain: number;
}

interface ThudSpec {
  freq: number;
  duration: number;
  gain: number;
}

interface PitchDroop {
  amount: number;
  time: number;
}

interface ImpactHit {
  delay: number;
  baseFreq: number;
  modes: ModalSpec[];
  attack?: AttackSpec;
  exciter: ExciterSpec;
  thud?: ThudSpec;
  pitchDroop?: PitchDroop;
  voices: number;
  detune: number;
  volume: number;
  jitter: number;
}

const IMPACTS: Record<SoundType, ImpactHit[]> = {
  tick: [
    {
      delay: 0,
      baseFreq: 620,
      modes: [
        { ratio: 1, q: 13, gain: 1.0 },
        { ratio: 2.4, q: 7, gain: 0.3 },
      ],
      attack: { duration: 0.003, filterHz: 2400, q: 1.2, gain: 0.1 },
      exciter: { duration: 0.03, filterHz: 2400 },
      voices: 1,
      detune: 0,
      volume: 0.3,
      jitter: 0.02,
    },
  ],
  move: [
    {
      delay: 0,
      baseFreq: 200,
      modes: [
        { ratio: 1, q: 11, gain: 1.0 },
        { ratio: 2.3, q: 7, gain: 0.42 },
        { ratio: 4.5, q: 4, gain: 0.11 },
      ],
      attack: { duration: 0.003, filterHz: 2050, q: 0.9, gain: 0.05 },
      exciter: { duration: 0.12, filterHz: 1950 },
      thud: { freq: 88, duration: 0.1, gain: 0.28 },
      voices: 2,
      detune: 6,
      volume: 0.65,
      jitter: 0.05,
    },
  ],
  capture: [
    {
      delay: 0,
      baseFreq: 160,
      modes: [
        { ratio: 1, q: 13, gain: 1.0 },
        { ratio: 2.3, q: 8, gain: 0.47 },
        { ratio: 4.5, q: 4, gain: 0.13 },
      ],
      attack: { duration: 0.004, filterHz: 1750, q: 0.8, gain: 0.06 },
      exciter: { duration: 0.18, filterHz: 1750 },
      thud: { freq: 74, duration: 0.13, gain: 0.32 },
      pitchDroop: { amount: 0.08, time: 0.05 },
      voices: 2,
      detune: 10,
      volume: 0.75,
      jitter: 0.05,
    },
    {
      delay: 0.08,
      baseFreq: 138,
      modes: [
        { ratio: 1, q: 9, gain: 0.65 },
        { ratio: 2.4, q: 5, gain: 0.24 },
      ],
      attack: { duration: 0.003, filterHz: 1600, q: 0.9, gain: 0.04 },
      exciter: { duration: 0.1, filterHz: 1400 },
      thud: { freq: 60, duration: 0.12, gain: 0.24 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.05,
    },
  ],
  // Two pieces land: the king's knock, then the rook's lighter one.
  castle: [
    {
      delay: 0,
      baseFreq: 200,
      modes: [
        { ratio: 1, q: 11, gain: 1.0 },
        { ratio: 2.3, q: 7, gain: 0.42 },
        { ratio: 4.5, q: 4, gain: 0.11 },
      ],
      attack: { duration: 0.003, filterHz: 2050, q: 0.9, gain: 0.05 },
      exciter: { duration: 0.12, filterHz: 1950 },
      thud: { freq: 88, duration: 0.1, gain: 0.28 },
      voices: 2,
      detune: 6,
      volume: 0.65,
      jitter: 0.05,
    },
    {
      delay: 0.1,
      baseFreq: 280,
      modes: [
        { ratio: 1, q: 11, gain: 1.0 },
        { ratio: 2.3, q: 7, gain: 0.42 },
      ],
      attack: { duration: 0.003, filterHz: 2050, q: 0.9, gain: 0.04 },
      exciter: { duration: 0.09, filterHz: 1950 },
      thud: { freq: 96, duration: 0.08, gain: 0.2 },
      voices: 1,
      detune: 0,
      volume: 0.45,
      jitter: 0.05,
    },
  ],
  // High, bright, no thud — a small celebration with a shimmer on top.
  promote: [
    {
      delay: 0,
      baseFreq: 520,
      modes: [
        { ratio: 1, q: 14, gain: 1.0 },
        { ratio: 2.0, q: 9, gain: 0.4 },
        { ratio: 3.2, q: 6, gain: 0.15 },
      ],
      attack: { duration: 0.002, filterHz: 3200, q: 1.2, gain: 0.04 },
      exciter: { duration: 0.06, filterHz: 3200 },
      voices: 2,
      detune: 5,
      volume: 0.55,
      jitter: 0.03,
    },
    {
      delay: 0.07,
      baseFreq: 780,
      modes: [
        { ratio: 1, q: 14, gain: 1.0 },
        { ratio: 2.0, q: 8, gain: 0.3 },
      ],
      attack: { duration: 0.002, filterHz: 3600, q: 1.2, gain: 0.03 },
      exciter: { duration: 0.05, filterHz: 3600 },
      voices: 1,
      detune: 0,
      volume: 0.35,
      jitter: 0.03,
    },
  ],
  check: [
    {
      delay: 0,
      baseFreq: 235,
      modes: [
        { ratio: 1, q: 10, gain: 1.0 },
        { ratio: 2, q: 6, gain: 0.38 },
        { ratio: 3.8, q: 4, gain: 0.1 },
      ],
      attack: { duration: 0.003, filterHz: 2200, q: 1.0, gain: 0.05 },
      exciter: { duration: 0.095, filterHz: 2200 },
      thud: { freq: 108, duration: 0.07, gain: 0.22 },
      voices: 2,
      detune: 5,
      volume: 0.65,
      jitter: 0.04,
    },
  ],
  mate: [
    {
      delay: 0,
      baseFreq: 125,
      modes: [
        { ratio: 1, q: 16, gain: 1.0 },
        { ratio: 2.1, q: 11, gain: 0.52 },
        { ratio: 3.8, q: 6, gain: 0.18 },
      ],
      attack: { duration: 0.005, filterHz: 1400, q: 0.7, gain: 0.1 },
      exciter: { duration: 0.4, filterHz: 1400 },
      thud: { freq: 55, duration: 0.35, gain: 0.44 },
      pitchDroop: { amount: 0.12, time: 0.08 },
      voices: 2,
      detune: 8,
      volume: 0.8,
      jitter: 0.05,
    },
  ],
  'game-start': [
    {
      delay: 0,
      baseFreq: 295,
      modes: [
        { ratio: 1, q: 9, gain: 1.0 },
        { ratio: 2.1, q: 5, gain: 0.32 },
        { ratio: 3.8, q: 4, gain: 0.1 },
      ],
      attack: { duration: 0.003, filterHz: 2000, q: 1.0, gain: 0.04 },
      exciter: { duration: 0.07, filterHz: 2000 },
      thud: { freq: 124, duration: 0.05, gain: 0.14 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.12,
      baseFreq: 370,
      modes: [
        { ratio: 1, q: 9, gain: 1.0 },
        { ratio: 2.1, q: 5, gain: 0.32 },
        { ratio: 3.8, q: 4, gain: 0.1 },
      ],
      attack: { duration: 0.003, filterHz: 2000, q: 1.0, gain: 0.04 },
      exciter: { duration: 0.07, filterHz: 2000 },
      thud: { freq: 124, duration: 0.05, gain: 0.14 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.24,
      baseFreq: 460,
      modes: [
        { ratio: 1, q: 9, gain: 1.0 },
        { ratio: 2.1, q: 5, gain: 0.32 },
        { ratio: 3.8, q: 4, gain: 0.1 },
      ],
      attack: { duration: 0.003, filterHz: 2000, q: 1.0, gain: 0.04 },
      exciter: { duration: 0.07, filterHz: 2000 },
      thud: { freq: 124, duration: 0.05, gain: 0.14 },
      voices: 1,
      detune: 0,
      volume: 0.55,
      jitter: 0.02,
    },
  ],
  // Puzzle solved: a bright three-note rise — celebratory, no thud, a shimmer
  // that resolves upward.
  success: [
    {
      delay: 0,
      baseFreq: 392,
      modes: [
        { ratio: 1, q: 12, gain: 1.0 },
        { ratio: 2.0, q: 8, gain: 0.32 },
        { ratio: 3.0, q: 5, gain: 0.12 },
      ],
      attack: { duration: 0.002, filterHz: 3000, q: 1.1, gain: 0.04 },
      exciter: { duration: 0.07, filterHz: 3000 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.1,
      baseFreq: 523,
      modes: [
        { ratio: 1, q: 12, gain: 1.0 },
        { ratio: 2.0, q: 8, gain: 0.32 },
        { ratio: 3.0, q: 5, gain: 0.12 },
      ],
      attack: { duration: 0.002, filterHz: 3200, q: 1.1, gain: 0.04 },
      exciter: { duration: 0.07, filterHz: 3200 },
      voices: 1,
      detune: 0,
      volume: 0.52,
      jitter: 0.02,
    },
    {
      delay: 0.22,
      baseFreq: 784,
      modes: [
        { ratio: 1, q: 14, gain: 1.0 },
        { ratio: 2.0, q: 9, gain: 0.28 },
      ],
      attack: { duration: 0.002, filterHz: 3600, q: 1.2, gain: 0.03 },
      exciter: { duration: 0.09, filterHz: 3600 },
      voices: 2,
      detune: 5,
      volume: 0.5,
      jitter: 0.02,
    },
  ],
  // Wrong move: a single low, detuned thud that droops in pitch — a flat "no".
  error: [
    {
      delay: 0,
      baseFreq: 150,
      modes: [
        { ratio: 1, q: 8, gain: 1.0 },
        { ratio: 1.9, q: 5, gain: 0.3 },
      ],
      attack: { duration: 0.004, filterHz: 1200, q: 0.7, gain: 0.08 },
      exciter: { duration: 0.16, filterHz: 1200 },
      thud: { freq: 70, duration: 0.18, gain: 0.4 },
      pitchDroop: { amount: 0.18, time: 0.12 },
      voices: 2,
      detune: 14,
      volume: 0.7,
      jitter: 0.03,
    },
  ],
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private bus: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private enabled = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      const bus = this.ctx.createGain();
      bus.gain.value = 0.9;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 4;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;
      bus.connect(limiter);
      limiter.connect(this.ctx.destination);
      this.bus = bus;
      this.limiter = limiter;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.ceil(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  playTick(lowTimeSoundEnabled: boolean): void {
    if (!lowTimeSoundEnabled) return;
    this.play('tick');
  }

  play(type: SoundType): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.bus) return;

    const hits = IMPACTS[type];
    const t0 = ctx.currentTime;
    for (const hit of hits) {
      this.scheduleHit(ctx, this.bus, t0, hit);
    }
  }

  private scheduleHit(ctx: AudioContext, dest: AudioNode, t0: number, hit: ImpactHit): void {
    const start = t0 + hit.delay;
    const jitter = 1 + (Math.random() * 2 - 1) * hit.jitter;
    const baseFreq = hit.baseFreq * jitter;
    const attack = 0.003;
    const floor = 0.0001;
    const peak = hit.volume;
    const voices = Math.max(1, hit.voices);
    const detune = hit.detune;
    const droopAmount = hit.pitchDroop?.amount ?? 0;
    const droopTime = hit.pitchDroop?.time ?? 0;

    for (let v = 0; v < voices; v++) {
      const voiceDetune = voices === 1 ? 0 : (v - (voices - 1) / 2) * detune;
      const voiceBase = baseFreq * Math.pow(2, voiceDetune / 1200);
      const voicePeak = peak / Math.sqrt(voices);

      const mix = ctx.createGain();
      mix.gain.value = voicePeak;
      mix.connect(dest);

      if (hit.modes.length > 0) {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuffer(ctx);
        const exciterLp = ctx.createBiquadFilter();
        exciterLp.type = 'lowpass';
        exciterLp.frequency.value = hit.exciter.filterHz;
        exciterLp.Q.value = 0.7;
        const exciterGain = ctx.createGain();
        exciterGain.gain.setValueAtTime(floor, start);
        exciterGain.gain.exponentialRampToValueAtTime(1, start + attack);
        exciterGain.gain.exponentialRampToValueAtTime(
          floor,
          start + attack + hit.exciter.duration,
        );
        src.connect(exciterLp);
        exciterLp.connect(exciterGain);

        for (const m of hit.modes) {
          const startFreq = voiceBase * m.ratio;
          const endFreq = startFreq * (1 - droopAmount);
          const mode = ctx.createBiquadFilter();
          mode.type = 'bandpass';
          mode.frequency.setValueAtTime(startFreq, start);
          if (droopAmount > 0) {
            mode.frequency.exponentialRampToValueAtTime(
              Math.max(endFreq, 20),
              start + droopTime,
            );
          }
          mode.Q.value = m.q;
          const g = ctx.createGain();
          g.gain.value = m.gain;
          exciterGain.connect(mode);
          mode.connect(g);
          g.connect(mix);
        }

        const stopTime = start + attack + hit.exciter.duration + 0.01;
        src.start(start);
        src.stop(stopTime);
      }

      if (hit.attack) {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuffer(ctx);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = hit.attack.filterHz;
        filter.Q.value = hit.attack.q;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(floor, start);
        gain.gain.exponentialRampToValueAtTime(1, start + attack);
        gain.gain.exponentialRampToValueAtTime(
          floor,
          start + attack + hit.attack.duration,
        );
        src.connect(filter);
        filter.connect(gain);
        gain.connect(mix);
        const stopTime = start + attack + hit.attack.duration + 0.01;
        src.start(start);
        src.stop(stopTime);
      }
    }

    if (hit.thud) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hit.thud.freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(floor, start);
      gain.gain.exponentialRampToValueAtTime(peak * hit.thud.gain, start + attack);
      gain.gain.exponentialRampToValueAtTime(floor, start + attack + hit.thud.duration);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + attack + hit.thud.duration + 0.01);
    }
  }
}

export const soundEngine = new SoundEngine();
