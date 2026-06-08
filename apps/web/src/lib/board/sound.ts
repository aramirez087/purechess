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
      baseFreq: 900,
      modes: [
        { ratio: 1, q: 18, gain: 1.0 },
        { ratio: 1.9, q: 12, gain: 0.4 },
        { ratio: 3.3, q: 7, gain: 0.2 },
      ],
      attack: { duration: 0.003, filterHz: 5500, q: 1.2, gain: 0.3 },
      exciter: { duration: 0.04, filterHz: 6000 },
      voices: 1,
      detune: 0,
      volume: 0.3,
      jitter: 0.02,
    },
  ],
  move: [
    {
      delay: 0,
      baseFreq: 380,
      modes: [
        { ratio: 1, q: 20, gain: 1.0 },
        { ratio: 2.3, q: 15, gain: 0.6 },
        { ratio: 4.1, q: 10, gain: 0.4 },
        { ratio: 6.7, q: 6, gain: 0.25 },
        { ratio: 9.8, q: 4, gain: 0.15 },
      ],
      attack: { duration: 0.004, filterHz: 4200, q: 1.0, gain: 0.35 },
      exciter: { duration: 0.1, filterHz: 4500 },
      thud: { freq: 110, duration: 0.08, gain: 0.18 },
      voices: 2,
      detune: 8,
      volume: 0.6,
      jitter: 0.04,
    },
  ],
  capture: [
    {
      delay: 0,
      baseFreq: 240,
      modes: [
        { ratio: 1, q: 25, gain: 1.0 },
        { ratio: 2.5, q: 18, gain: 0.65 },
        { ratio: 4.8, q: 12, gain: 0.45 },
        { ratio: 7.9, q: 8, gain: 0.3 },
        { ratio: 11.5, q: 5, gain: 0.2 },
      ],
      attack: { duration: 0.005, filterHz: 3200, q: 0.9, gain: 0.45 },
      exciter: { duration: 0.15, filterHz: 3500 },
      thud: { freq: 85, duration: 0.12, gain: 0.22 },
      pitchDroop: { amount: 0.08, time: 0.04 },
      voices: 2,
      detune: 12,
      volume: 0.7,
      jitter: 0.05,
    },
    {
      delay: 0.07,
      baseFreq: 180,
      modes: [
        { ratio: 1, q: 18, gain: 0.8 },
        { ratio: 2.4, q: 12, gain: 0.4 },
        { ratio: 4.5, q: 8, gain: 0.25 },
        { ratio: 7.2, q: 5, gain: 0.15 },
      ],
      attack: { duration: 0.003, filterHz: 2800, q: 1.0, gain: 0.2 },
      exciter: { duration: 0.09, filterHz: 3000 },
      thud: { freq: 70, duration: 0.1, gain: 0.15 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.05,
    },
  ],
  check: [
    {
      delay: 0,
      baseFreq: 440,
      modes: [
        { ratio: 1, q: 18, gain: 1.0 },
        { ratio: 1.8, q: 15, gain: 0.55 },
        { ratio: 3.2, q: 12, gain: 0.45 },
        { ratio: 5.1, q: 8, gain: 0.3 },
        { ratio: 7.4, q: 5, gain: 0.2 },
      ],
      attack: { duration: 0.003, filterHz: 5000, q: 1.2, gain: 0.4 },
      exciter: { duration: 0.08, filterHz: 5000 },
      thud: { freq: 130, duration: 0.06, gain: 0.15 },
      voices: 2,
      detune: 6,
      volume: 0.65,
      jitter: 0.03,
    },
  ],
  mate: [
    {
      delay: 0,
      baseFreq: 170,
      modes: [
        { ratio: 1, q: 35, gain: 1.0 },
        { ratio: 2.2, q: 25, gain: 0.7 },
        { ratio: 3.9, q: 18, gain: 0.5 },
        { ratio: 6.3, q: 12, gain: 0.35 },
        { ratio: 9.2, q: 7, gain: 0.25 },
      ],
      attack: { duration: 0.006, filterHz: 2500, q: 0.8, gain: 0.5 },
      exciter: { duration: 0.3, filterHz: 2500 },
      thud: { freq: 70, duration: 0.3, gain: 0.3 },
      pitchDroop: { amount: 0.12, time: 0.06 },
      voices: 2,
      detune: 10,
      volume: 0.75,
      jitter: 0.05,
    },
  ],
  'game-start': [
    {
      delay: 0,
      baseFreq: 480,
      modes: [
        { ratio: 1, q: 18, gain: 1.0 },
        { ratio: 2.1, q: 13, gain: 0.5 },
        { ratio: 3.8, q: 9, gain: 0.3 },
        { ratio: 5.9, q: 5, gain: 0.2 },
      ],
      attack: { duration: 0.004, filterHz: 4500, q: 1.0, gain: 0.3 },
      exciter: { duration: 0.08, filterHz: 4500 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.12,
      baseFreq: 605,
      modes: [
        { ratio: 1, q: 18, gain: 1.0 },
        { ratio: 2.1, q: 13, gain: 0.5 },
        { ratio: 3.8, q: 9, gain: 0.3 },
        { ratio: 5.9, q: 5, gain: 0.2 },
      ],
      attack: { duration: 0.004, filterHz: 4500, q: 1.0, gain: 0.3 },
      exciter: { duration: 0.08, filterHz: 4500 },
      voices: 1,
      detune: 0,
      volume: 0.5,
      jitter: 0.02,
    },
    {
      delay: 0.24,
      baseFreq: 720,
      modes: [
        { ratio: 1, q: 18, gain: 1.0 },
        { ratio: 2.1, q: 13, gain: 0.5 },
        { ratio: 3.8, q: 9, gain: 0.3 },
        { ratio: 5.9, q: 5, gain: 0.2 },
      ],
      attack: { duration: 0.004, filterHz: 4500, q: 1.0, gain: 0.3 },
      exciter: { duration: 0.08, filterHz: 4500 },
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
    const attack = 0.002;
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
