import { Injectable } from '@nestjs/common';

interface WaitSample {
  ms: number;
  recordedAt: number;
}

export interface MetricsSnapshot {
  activeGames: number;
  queueDepth: Record<string, number>;
  avgMatchWaitMs: number;
  movesPerSecond: number;
  errorsPerMinute: number;
}

@Injectable()
export class MetricsService {
  private activeGames = 0;
  private queueDepth: Record<string, number> = {};
  private waitSamples: WaitSample[] = [];
  private moveTimestamps: number[] = [];
  private errorTimestamps: number[] = [];

  setActiveGames(count: number): void {
    this.activeGames = count;
  }

  setQueueDepth(category: string, depth: number): void {
    this.queueDepth[category] = depth;
  }

  recordMatchWait(ms: number): void {
    this.waitSamples.push({ ms, recordedAt: Date.now() });
    this.pruneWaitSamples();
  }

  incrementMoveCount(): void {
    this.moveTimestamps.push(Date.now());
    this.pruneMoveTimestamps();
  }

  incrementErrorCount(): void {
    this.errorTimestamps.push(Date.now());
    this.pruneErrorTimestamps();
  }

  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    this.pruneWaitSamples();
    this.pruneMoveTimestamps();
    this.pruneErrorTimestamps();

    const recentWaits = this.waitSamples.filter((s) => now - s.recordedAt < 5 * 60 * 1000);
    const avgMatchWaitMs =
      recentWaits.length > 0
        ? recentWaits.reduce((sum, s) => sum + s.ms, 0) / recentWaits.length
        : 0;

    const movesLastSecond = this.moveTimestamps.filter((t) => now - t < 1000).length;
    const errorsLastMinute = this.errorTimestamps.filter((t) => now - t < 60 * 1000).length;

    return {
      activeGames: this.activeGames,
      queueDepth: { ...this.queueDepth },
      avgMatchWaitMs: Math.round(avgMatchWaitMs),
      movesPerSecond: movesLastSecond,
      errorsPerMinute: errorsLastMinute,
    };
  }

  private pruneWaitSamples(): void {
    const cutoff = Date.now() - 5 * 60 * 1000;
    this.waitSamples = this.waitSamples.filter((s) => s.recordedAt > cutoff);
  }

  private pruneMoveTimestamps(): void {
    const cutoff = Date.now() - 1000;
    this.moveTimestamps = this.moveTimestamps.filter((t) => t > cutoff);
  }

  private pruneErrorTimestamps(): void {
    const cutoff = Date.now() - 60 * 1000;
    this.errorTimestamps = this.errorTimestamps.filter((t) => t > cutoff);
  }
}
