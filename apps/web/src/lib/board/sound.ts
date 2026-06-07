import type { SoundType } from './types';

interface ToneParams {
  frequency: number;
  duration: number;
  attack: number;
  decay: number;
  type: OscillatorType;
  volume: number;
}

const TONES: Record<SoundType, ToneParams[]> = {
  move: [
    { frequency: 440, duration: 0.08, attack: 0.005, decay: 0.07, type: 'sine', volume: 0.3 },
  ],
  capture: [
    { frequency: 300, duration: 0.06, attack: 0.005, decay: 0.05, type: 'square', volume: 0.25 },
    { frequency: 220, duration: 0.1, attack: 0.005, decay: 0.09, type: 'sine', volume: 0.2 },
  ],
  check: [
    { frequency: 600, duration: 0.1, attack: 0.005, decay: 0.09, type: 'sine', volume: 0.35 },
    { frequency: 800, duration: 0.08, attack: 0.005, decay: 0.07, type: 'sine', volume: 0.2 },
  ],
  mate: [
    { frequency: 200, duration: 0.3, attack: 0.01, decay: 0.28, type: 'sawtooth', volume: 0.4 },
    { frequency: 150, duration: 0.5, attack: 0.01, decay: 0.48, type: 'sine', volume: 0.35 },
  ],
  'game-start': [
    { frequency: 523, duration: 0.1, attack: 0.005, decay: 0.09, type: 'sine', volume: 0.3 },
    { frequency: 659, duration: 0.1, attack: 0.005, decay: 0.09, type: 'sine', volume: 0.3 },
    { frequency: 784, duration: 0.15, attack: 0.005, decay: 0.14, type: 'sine', volume: 0.35 },
  ],
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(type: SoundType): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const tones = TONES[type];
    let offset = 0;

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = tone.type;
      osc.frequency.value = tone.frequency;

      gain.gain.setValueAtTime(0, ctx.currentTime + offset);
      gain.gain.linearRampToValueAtTime(tone.volume, ctx.currentTime + offset + tone.attack);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + tone.duration + 0.01);

      if (type === 'game-start') {
        offset += 0.12;
      }
    }
  }
}

export const soundEngine = new SoundEngine();
