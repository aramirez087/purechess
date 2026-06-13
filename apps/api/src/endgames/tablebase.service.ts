import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

/**
 * Probe of a single position against the lichess tablebase, normalized for our
 * client. `category` is from the SIDE-TO-MOVE's point of view.
 */
export interface TablebaseProbe {
  category: 'win' | 'draw' | 'loss' | 'unknown';
  /** Best move for the side to move, UCI, when in tablebase. */
  bestMove?: string;
  /** Distance to mate in plies (side-to-move POV) when known. */
  dtm?: number;
}

/** The slice of the lichess tablebase JSON we consume. */
interface LichessTablebaseResponse {
  category?: string;
  dtm?: number | null;
  moves?: Array<{ uci?: string; category?: string; dtm?: number | null }>;
}

const TABLEBASE_URL = 'https://tablebase.lichess.ovh/standard';
const CACHE_PREFIX = 'endgame:tb:';
/** Positions are immutable — cache hard. 30 days is effectively forever. */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
/** Politeness / liveness: never block the request path on a slow upstream. */
const FETCH_TIMEOUT_MS = 4000;
/** The lichess tablebase only holds positions with 7 men or fewer. */
const MAX_TABLEBASE_MEN = 7;

const UNKNOWN: TablebaseProbe = { category: 'unknown' };

/**
 * Server-side proxy to the lichess 7-man tablebase. Keeps the upstream URL off
 * the client and caches every immutable result HARD in Redis (key = the FEN).
 *
 * Degrades gracefully: more than 7 men (not in the tablebase), an upstream
 * error, a timeout, or a malformed body all resolve to `{ category: 'unknown' }`
 * so the caller falls back to Stockfish — this service NEVER throws into the
 * request path.
 *
 * The lichess `category` is reported from the side-to-move POV; we surface the
 * top-ranked move's UCI as `bestMove` (for a defender that means the toughest
 * defence; for the attacker, the fastest win).
 */
@Injectable()
export class TablebaseService {
  private readonly logger = new Logger(TablebaseService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Probe `fen`. Cache-first; on a miss, query lichess and cache the normalized
   * result. Any failure (timeout/network/parse) returns 'unknown' and is logged
   * but never thrown.
   */
  async probe(fen: string): Promise<TablebaseProbe> {
    const trimmed = fen.trim();
    if (!trimmed) return UNKNOWN;

    // Positions with too many men are never in the tablebase — short-circuit
    // (don't waste an upstream call, don't poison the cache for retries).
    if (countMen(trimmed) > MAX_TABLEBASE_MEN) return UNKNOWN;

    const key = CACHE_PREFIX + trimmed;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as TablebaseProbe;
    } catch (err) {
      // A cache read failure must not fail the probe — fall through to fetch.
      this.logger.warn(`tablebase cache read failed: ${describe(err)}`);
    }

    const probe = await this.fetchProbe(trimmed);

    // Only cache a KNOWN result. An 'unknown' from a transient upstream blip
    // must not be pinned for 30 days — let the next probe retry.
    if (probe.category !== 'unknown') {
      try {
        await this.redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(probe));
      } catch (err) {
        this.logger.warn(`tablebase cache write failed: ${describe(err)}`);
      }
    }
    return probe;
  }

  /** Single upstream call with a timeout; normalizes or degrades to 'unknown'. */
  private async fetchProbe(fen: string): Promise<TablebaseProbe> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const url = `${TABLEBASE_URL}?fen=${encodeURIComponent(fen)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        this.logger.warn(`tablebase HTTP ${res.status} for "${fen}"`);
        return UNKNOWN;
      }
      const body = (await res.json()) as LichessTablebaseResponse;
      return normalize(body);
    } catch (err) {
      this.logger.warn(`tablebase fetch failed for "${fen}": ${describe(err)}`);
      return UNKNOWN;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Count the pieces on a FEN board (men) — the first FEN field. */
export function countMen(fen: string): number {
  const board = fen.split(/\s+/)[0] ?? '';
  let men = 0;
  for (const ch of board) {
    if (/[a-zA-Z]/.test(ch)) men++;
  }
  return men;
}

/** Map a lichess tablebase body to our normalized probe. Pure. */
export function normalize(body: LichessTablebaseResponse): TablebaseProbe {
  const category = mapCategory(body.category);
  if (category === 'unknown') return UNKNOWN;

  const top = body.moves?.[0];
  const probe: TablebaseProbe = { category };
  if (top?.uci) probe.bestMove = top.uci;
  if (typeof body.dtm === 'number') probe.dtm = body.dtm;
  return probe;
}

/**
 * Collapse the lichess category vocabulary (win/loss/draw plus the cursed/
 * blessed 50-move variants) into our four-value set. Anything unrecognized
 * (incl. the absent field for an out-of-tablebase position) is 'unknown'.
 */
function mapCategory(category: string | undefined): TablebaseProbe['category'] {
  switch (category) {
    case 'win':
      return 'win';
    case 'loss':
      return 'loss';
    case 'draw':
    case 'cursed-win': // win on the board but drawn under the 50-move rule
    case 'blessed-loss': // loss on the board but drawn under the 50-move rule
      return 'draw';
    default:
      return 'unknown';
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
