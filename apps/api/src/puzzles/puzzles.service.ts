import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { LichessPuzzleData } from './puzzles.types';

const CACHE_KEY = 'puzzle:daily';
const TTL_SECONDS = 60 * 60 * 24; // 24h — Lichess rotates the daily puzzle once a day.
const LICHESS_DAILY_URL = 'https://lichess.org/api/puzzle/daily';

@Injectable()
export class PuzzlesService {
  private readonly logger = new Logger(PuzzlesService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Returns today's Lichess daily puzzle, cached in Redis for 24h so we hit the
   * upstream API at most once per day (and stay well within its rate limits).
   */
  async getDailyPuzzle(): Promise<LichessPuzzleData> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as LichessPuzzleData;

    const res = await fetch(LICHESS_DAILY_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      this.logger.error(`lichess puzzle API responded ${res.status}`);
      throw new Error(`lichess puzzle API: ${res.status}`);
    }
    const data = (await res.json()) as LichessPuzzleData;

    await this.redis.setex(CACHE_KEY, TTL_SECONDS, JSON.stringify(data));
    return data;
  }
}
