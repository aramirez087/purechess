import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import type {
  ChessComGameDto,
  ChessComGamesDto,
  ChessComLinkDto,
  ChessComOpeningClusterDto,
  ChessComOpeningMistakeDto,
  ChessComOpeningMistakesDto,
  SaveChessComMistakesDto,
} from '@purechess/shared';

const CHESS_COM_API = 'https://api.chess.com/pub';
/** How many monthly archives to walk back from the current month. */
const MONTHS_TO_FETCH = 3;
/** Cap games returned per sync — keeps client analysis finishable. */
const MAX_GAMES = 30;
/** Max persisted mistakes per user. */
const MAX_MISTAKES = 200;

interface ChessComArchiveMonth {
  games: Array<{
    url: string;
    pgn: string;
    end_time: number;
    time_control: string;
    white: { username: string; rating: number };
    black: { username: string; rating: number };
  }>;
}

interface SyncMeta {
  lastSyncedAt: string;
  gamesScanned: number;
}

function linkKey(userId: string): string {
  return `chesscom:link:${userId}`;
}

function mistakesKey(userId: string): string {
  return `chesscom:mistakes:${userId}`;
}

function metaKey(userId: string): string {
  return `chesscom:meta:${userId}`;
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** YYYY/M from a Date (chess.com archive path uses unpadded month). */
function archivePath(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`;
}

/**
 * Chess.com public API integration — no OAuth. The server fetches archived
 * games for a linked username; opening analysis runs client-side (Stockfish)
 * and mistakes are posted back for insights + the openings hub.
 *
 * Storage is Redis-only (no schema migration): link, sync meta, and the
 * mistake backlog mirror the opening-lab review pattern.
 */
@Injectable()
export class ChessComService {
  private readonly logger = new Logger(ChessComService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async getLink(userId: string): Promise<ChessComLinkDto> {
    const username = await this.redis.get(linkKey(userId));
    const meta = await this.readMeta(userId);
    const mistakes = await this.readMistakes(userId);
    return {
      username,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
      gamesScanned: meta?.gamesScanned,
      mistakeCount: mistakes.length,
    };
  }

  async setLink(userId: string, rawUsername: string): Promise<ChessComLinkDto> {
    const username = normalizeUsername(rawUsername);
    if (!username || username.length > 50) {
      throw new BadRequestException('Enter a valid chess.com username.');
    }
    await this.assertPlayerExists(username);
    await this.redis.set(linkKey(userId), username);
    return this.getLink(userId);
  }

  async clearLink(userId: string): Promise<ChessComLinkDto> {
    await this.redis.del(linkKey(userId), mistakesKey(userId), metaKey(userId));
    return { username: null };
  }

  /** Fetch recent games for the linked user (newest first, capped). */
  async fetchGames(userId: string): Promise<ChessComGamesDto> {
    const username = await this.requireLink(userId);
    const months: string[] = [];
    const cursor = new Date();
    for (let i = 0; i < MONTHS_TO_FETCH; i++) {
      months.push(archivePath(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }

    const collected: ChessComGameDto[] = [];
    for (const month of months) {
      if (collected.length >= MAX_GAMES) break;
      const archive = await this.fetchArchive(username, month);
      for (const g of archive.games) {
        if (collected.length >= MAX_GAMES) break;
        if (!g.pgn?.trim()) continue;
        const userColor = this.userColorInGame(username, g.white.username, g.black.username);
        if (!userColor) continue;
        collected.push({
          id: g.url,
          url: g.url,
          pgn: g.pgn,
          endTime: g.end_time,
          timeControl: g.time_control,
          white: g.white,
          black: g.black,
          userColor,
        });
      }
    }

    collected.sort((a, b) => b.endTime - a.endTime);
    return {
      username,
      games: collected.slice(0, MAX_GAMES),
      monthsFetched: months.length,
    };
  }

  async saveMistakes(
    userId: string,
    dto: SaveChessComMistakesDto,
  ): Promise<ChessComOpeningMistakesDto> {
    await this.requireLink(userId);
    const existing = await this.readMistakes(userId);
    const byKey = new Map(existing.map((m) => [`${m.gameId}:${m.ply}`, m]));

    const now = new Date().toISOString();
    for (const c of dto.mistakes) {
      if (c.cpLoss < 80) continue;
      const key = `${c.gameId}:${c.ply}`;
      byKey.set(key, {
        gameId: c.gameId,
        gameUrl: c.gameUrl,
        ply: c.ply,
        fen: c.fen,
        playedUci: c.playedUci,
        playedSan: c.playedSan,
        bestUci: c.bestUci,
        bestSan: c.bestSan,
        cpLoss: c.cpLoss,
        openingLabel: c.openingLabel,
        playedAt: c.playedAt,
        reviewed: byKey.get(key)?.reviewed ?? false,
        createdAt: byKey.get(key)?.createdAt ?? now,
      });
    }

    const merged = [...byKey.values()]
      .sort((a, b) => {
        const ta = a.playedAt ? new Date(a.playedAt).getTime() : 0;
        const tb = b.playedAt ? new Date(b.playedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, MAX_MISTAKES);

    await this.redis.set(mistakesKey(userId), JSON.stringify(merged));
    return this.listMistakes(userId);
  }

  /** Record how many games were scanned in the last client sync. */
  async recordSync(userId: string, gamesScanned: number): Promise<ChessComLinkDto> {
    await this.requireLink(userId);
    const meta: SyncMeta = {
      lastSyncedAt: new Date().toISOString(),
      gamesScanned,
    };
    await this.redis.set(metaKey(userId), JSON.stringify(meta));
    return this.getLink(userId);
  }

  async listMistakes(userId: string): Promise<ChessComOpeningMistakesDto> {
    const mistakes = await this.readMistakes(userId);
    return {
      mistakes,
      clusters: clusterMistakes(mistakes),
    };
  }

  /** Mistakes for the insights engine (read-only). */
  async getMistakesForInsights(userId: string): Promise<ChessComOpeningMistakeDto[]> {
    return this.readMistakes(userId);
  }

  async markReviewed(userId: string, gameId: string, ply: number): Promise<void> {
    const mistakes = await this.readMistakes(userId);
    const idx = mistakes.findIndex((m) => m.gameId === gameId && m.ply === ply);
    if (idx < 0) throw new NotFoundException('Mistake not found');
    mistakes[idx] = { ...mistakes[idx], reviewed: true };
    await this.redis.set(mistakesKey(userId), JSON.stringify(mistakes));
  }

  private async requireLink(userId: string): Promise<string> {
    const username = await this.redis.get(linkKey(userId));
    if (!username) {
      throw new BadRequestException('Link a chess.com username first.');
    }
    return username;
  }

  private async readMistakes(userId: string): Promise<ChessComOpeningMistakeDto[]> {
    const raw = await this.redis.get(mistakesKey(userId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ChessComOpeningMistakeDto[];
    } catch {
      this.logger.warn(`Corrupt chess.com mistakes for ${userId}`);
      return [];
    }
  }

  private async readMeta(userId: string): Promise<SyncMeta | null> {
    const raw = await this.redis.get(metaKey(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SyncMeta;
    } catch {
      return null;
    }
  }

  private async assertPlayerExists(username: string): Promise<void> {
    const res = await fetch(`${CHESS_COM_API}/player/${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'PureChess/1.0' },
    });
    if (res.status === 404) {
      throw new BadRequestException(`No chess.com player named "${username}".`);
    }
    if (!res.ok) {
      throw new BadRequestException('Could not reach chess.com — try again shortly.');
    }
  }

  private async fetchArchive(username: string, month: string): Promise<ChessComArchiveMonth> {
    const url = `${CHESS_COM_API}/player/${encodeURIComponent(username)}/games/${month}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'PureChess/1.0' },
    });
    if (res.status === 404) return { games: [] };
    if (!res.ok) {
      this.logger.warn(`chess.com archive ${month} responded ${res.status}`);
      return { games: [] };
    }
    return res.json() as Promise<ChessComArchiveMonth>;
  }

  private userColorInGame(
    linked: string,
    white: string,
    black: string,
  ): 'white' | 'black' | undefined {
    const w = white.toLowerCase();
    const b = black.toLowerCase();
    if (w === linked) return 'white';
    if (b === linked) return 'black';
    return undefined;
  }
}

/** Group mistakes by opening label for the hub UI. */
export function clusterMistakes(
  mistakes: ChessComOpeningMistakeDto[],
): ChessComOpeningClusterDto[] {
  const byLabel = new Map<string, ChessComOpeningMistakeDto[]>();
  for (const m of mistakes) {
    const bucket = byLabel.get(m.openingLabel) ?? [];
    bucket.push(m);
    byLabel.set(m.openingLabel, bucket);
  }
  return [...byLabel.entries()]
    .map(([openingLabel, items]) => {
      const cpSum = items.reduce((s, m) => s + m.cpLoss, 0);
      const latest = items.reduce<string | undefined>((best, m) => {
        if (!m.playedAt) return best;
        if (!best || m.playedAt > best) return m.playedAt;
        return best;
      }, undefined);
      return {
        openingLabel,
        count: items.length,
        latestPlayedAt: latest,
        avgCpLoss: Math.round(cpSum / items.length),
      };
    })
    .sort((a, b) => b.count - a.count);
}

