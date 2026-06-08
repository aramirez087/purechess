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
      baseFreq: 600,
      modes: [
        { ratio: 1, q: 12, gain: 1.0 },
        { ratio: 2.5, q: 7, gain: 0.3 },
      ],
      exciter: { duration: 0.03, filterHz: 2200 },
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
        { ratio: 1, q: 12, gain: 1.0 },
        { ratio: 2.3, q: 8, gain: 0.4 },
        { ratio: 4.5, q: 4, gain: 0.12 },
      ],
      exciter: { duration: 0.12, filterHz: 1800 },
      thud: { freq: 90, duration: 0.1, gain: 0.3 },
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
        { ratio: 1, q: 14, gain: 1.0 },
        { ratio: 2.3, q: 9, gain: 0.45 },
        { ratio: 4.2, q: 5, gain: 0.15 },
      ],
      exciter: { duration: 0.18, filterHz: 1500 },
      thud: { freq: 75, duration: 0.14, gain: 0.35 },
      pitchDroop: { amount: 0.08, time: 0.05 },
      voices: 2,
      detune: 10,
      volume: 0.75,
      jitter: 0.05,
    },
    {
      delay: 0.08,
      baseFreq: 140,
      modes: [
        { ratio: 1, q: 10, gain: 0.7 },
        { ratio: 2.4, q: 6, gain: 0.3 },
      ],
      exciter: { duration: 0.1, filterHz: 1400 },
      thud: { freq: 65, duration: 0.12, gain: 0.25 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.05,
    },
  ],
  check: [
    {
      delay: 0,
      baseFreq: 240,
      modes: [
        { ratio: 1, q: 11, gain: 1.0 },
        { ratio: 2, q: 7, gain: 0.4 },
        { ratio: 3.8, q: 4, gain: 0.1 },
      ],
      exciter: { duration: 0.09, filterHz: 2000 },
      thud: { freq: 110, duration: 0.07, gain: 0.22 },
      voices: 2,
      detune: 5,
      volume: 0.65,
      jitter: 0.04,
    },
  ],
  mate: [
    {
      delay: 0,
      baseFreq: 120,
      modes: [
        { ratio: 1, q: 18, gain: 1.0 },
        { ratio: 2.1, q: 12, gain: 0.55 },
        { ratio: 3.6, q: 7, gain: 0.2 },
      ],
      exciter: { duration: 0.4, filterHz: 1200 },
      thud: { freq: 55, duration: 0.4, gain: 0.45 },
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
      baseFreq: 300,
      modes: [
        { ratio: 1, q: 10, gain: 1.0 },
        { ratio: 2.1, q: 6, gain: 0.35 },
        { ratio: 4, q: 4, gain: 0.1 },
      ],
      exciter: { duration: 0.07, filterHz: 2000 },
      thud: { freq: 130, duration: 0.05, gain: 0.15 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.12,
      baseFreq: 380,
      modes: [
        { ratio: 1, q: 10, gain: 1.0 },
        { ratio: 2.1, q: 6, gain: 0.35 },
        { ratio: 4, q: 4, gain: 0.1 },
      ],
      exciter: { duration: 0.07, filterHz: 2000 },
      thud: { freq: 130, duration: 0.05, gain: 0.15 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.24,
      baseFreq: 480,
      modes: [
        { ratio: 1, q: 10, gain: 1.0 },
        { ratio: 2.1, q: 6, gain: 0.35 },
        { ratio: 4, q: 4, gain: 0.1 },
      ],
      exciter: { duration: 0.07, filterHz: 2000 },
      thud: { freq: 130, duration: 0.05, gain: 0.15 },
      voices: 1,
      detune: 0,
      volume: 0.55,
      jitter: 0.02,
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
