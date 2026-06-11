import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  MATCHMAKING_TIME_CONTROLS,
  MatchmakingJoinResponseDto,
  MatchmakingStatusDto,
  MatchmakingTimeControl,
} from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PosthogService } from '../analytics/posthog.service';
import { JoinMatchmakingDto } from './dto/join-matchmaking.dto';

/** Queue-entry heartbeat: refreshed by the client's status poll. */
const QUEUE_TTL_SECONDS = 30;
const BASE_WINDOW = 200;
const WINDOW_STEP = 100;
const MAX_WINDOW = 800;
const MAILBOX_TTL_SECONDS = 60;

const poolKey = (rated: boolean, tc: number, inc: number) =>
  `mm:q:${rated ? 'rated' : 'casual'}:${tc}+${inc}`;
const userKey = (userId: string) => `mm:u:${userId}`;
const matchKey = (userId: string) => `mm:match:${userId}`;

/** Script return when a status re-scan finds the caller already claimed. */
const CLAIMED_SENTINEL = '__claimed__';

/**
 * A claimed candidate (or the caller) turned out to already be in an active
 * game — the pairing is void. Both entries are already out of the queue; the
 * non-busy player's client self-heals (next poll sees no entry → 'idle' →
 * auto re-join), the busy one is correctly gone.
 */
class StaleCandidateError extends Error {
  constructor() {
    super('Claimed candidate already in an active game');
  }
}

/**
 * Claim-or-enqueue in ONE script so two concurrent joins can neither
 * double-pair nor both see an empty pool and miss each other: of two
 * simultaneous joins, Redis's single-threaded execution guarantees exactly
 * one enqueues and the other claims it. Entries whose mm:u:* hash has
 * TTL-expired are orphans and are reaped during the scan (lazy janitor).
 *
 * ARGV[10] ('1' on status re-scans) demands the caller's own entry still
 * exist: a poll that read its entry just before an opponent's claim deleted
 * it must NOT re-enqueue a ghost of a player who is already in a game — it
 * gets the sentinel back and picks the pairing up from the match mailbox on
 * the next poll instead.
 */
const MM_JOIN_LUA = `
if ARGV[10] == '1' and redis.call('EXISTS', 'mm:u:' .. ARGV[1]) == 0 then
  return '${CLAIMED_SENTINEL}'
end
local min = tonumber(ARGV[2]) - tonumber(ARGV[3])
local max = tonumber(ARGV[2]) + tonumber(ARGV[3])
local cands = redis.call('ZRANGEBYSCORE', KEYS[1], min, max, 'WITHSCORES', 'LIMIT', 0, 20)
local best, bestDiff = nil, nil
for i = 1, #cands, 2 do
  local id, score = cands[i], tonumber(cands[i + 1])
  if id ~= ARGV[1] then
    if redis.call('EXISTS', 'mm:u:' .. id) == 1 then
      local diff = math.abs(score - tonumber(ARGV[2]))
      if best == nil or diff < bestDiff then best, bestDiff = id, diff end
    else
      redis.call('ZREM', KEYS[1], id)
    end
  end
end
if best then
  redis.call('ZREM', KEYS[1], best)
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('DEL', 'mm:u:' .. best)
  redis.call('DEL', 'mm:u:' .. ARGV[1])
  return best
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('HSET', 'mm:u:' .. ARGV[1], 'pool', KEYS[1], 'rating', ARGV[2],
  'joinedAt', ARGV[4], 'timeControlSeconds', ARGV[6], 'incrementSeconds', ARGV[7],
  'category', ARGV[8], 'rated', ARGV[9])
redis.call('EXPIRE', 'mm:u:' .. ARGV[1], tonumber(ARGV[5]))
return nil
`;

interface MatchmakingRedis extends Redis {
  mmJoin(
    pool: string,
    selfId: string,
    rating: number,
    window: number,
    joinedAtMs: number,
    ttlSeconds: number,
    tc: number,
    inc: number,
    category: string,
    rated: string,
    mustExist: string,
  ): Promise<string | null>;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly redis: MatchmakingRedis;

  constructor(
    @Inject('REDIS_CLIENT') redis: Redis,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly posthog: PosthogService,
  ) {
    redis.defineCommand('mmJoin', { numberOfKeys: 1, lua: MM_JOIN_LUA });
    this.redis = redis as MatchmakingRedis;
  }

  private findPreset(dto: JoinMatchmakingDto): MatchmakingTimeControl {
    const preset = MATCHMAKING_TIME_CONTROLS.find(
      (p) =>
        p.seconds === dto.timeControlSeconds &&
        p.increment === dto.incrementSeconds &&
        p.category === dto.category,
    );
    if (!preset) {
      throw new BadRequestException('Unknown quick-match time control');
    }
    return preset;
  }

  private async ratingFor(userId: string, category: string): Promise<number> {
    const row = await this.prisma.rating.findUnique({
      where: {
        userId_category: {
          userId,
          category: category as 'bullet' | 'blitz' | 'rapid',
        },
      },
      select: { rating: true },
    });
    return row?.rating ?? 1500;
  }

  async join(userId: string, dto: JoinMatchmakingDto): Promise<MatchmakingJoinResponseDto> {
    const preset = this.findPreset(dto);
    const rated = dto.rated ?? true;

    const activeGame = await this.prisma.game.findFirst({
      where: {
        status: 'active',
        isVsComputer: false,
        OR: [{ whiteUserId: userId }, { blackUserId: userId }],
      },
      select: { id: true },
    });
    if (activeGame) {
      throw new ConflictException('Already in an active game');
    }

    // Switching pools? Drop the old entry first (one queue per user).
    const pool = poolKey(rated, preset.seconds, preset.increment);
    const existingPool = await this.redis.hget(userKey(userId), 'pool');
    if (existingPool && existingPool !== pool) {
      await this.leave(userId);
    }

    const rating = await this.ratingFor(userId, preset.category);
    const opponentId = await this.redis.mmJoin(
      pool,
      userId,
      rating,
      BASE_WINDOW,
      Date.now(),
      QUEUE_TTL_SECONDS,
      preset.seconds,
      preset.increment,
      preset.category,
      rated ? '1' : '0',
      '0',
    );

    if (!opponentId) {
      this.posthog.captureEvent(userId, 'matchmaking_joined', {
        category: preset.category,
        time_control: preset.label,
        rated,
        rating,
      });
      return { status: 'queued' };
    }

    try {
      const gameId = await this.createMatchedGame(userId, opponentId, preset, rated);
      return { status: 'matched', gameId };
    } catch (err) {
      if (err instanceof StaleCandidateError) return { status: 'queued' };
      throw err;
    }
  }

  async leave(userId: string): Promise<{ ok: true }> {
    const pool = await this.redis.hget(userKey(userId), 'pool');
    if (pool) {
      await this.redis.zrem(pool, userId);
      await this.redis.del(userKey(userId));
      this.posthog.captureEvent(userId, 'matchmaking_left', {});
    }
    return { ok: true };
  }

  /**
   * Heartbeat + missed-push recovery + window widening. Called every ~2s by
   * a searching client: refreshes the queue-entry TTL and retries the pair
   * scan with a window that grows with wait time — no background worker.
   */
  async status(userId: string): Promise<MatchmakingStatusDto> {
    const mailbox = await this.redis.get(matchKey(userId));
    if (mailbox) {
      await this.redis.del(matchKey(userId));
      return { status: 'matched', gameId: mailbox };
    }

    const entry = await this.redis.hgetall(userKey(userId));
    if (!entry || !entry['pool']) return { status: 'idle' };

    await this.redis.expire(userKey(userId), QUEUE_TTL_SECONDS);
    const joinedAt = Number(entry['joinedAt']) || Date.now();
    const waitSeconds = Math.max(0, Math.floor((Date.now() - joinedAt) / 1000));
    const window = Math.min(BASE_WINDOW + WINDOW_STEP * Math.floor(waitSeconds / 10), MAX_WINDOW);

    const rated = entry['rated'] === '1';
    const opponentId = await this.redis.mmJoin(
      entry['pool'],
      userId,
      Number(entry['rating']) || 1500,
      window,
      joinedAt,
      QUEUE_TTL_SECONDS,
      Number(entry['timeControlSeconds']) || 0,
      Number(entry['incrementSeconds']) || 0,
      entry['category'] ?? 'blitz',
      rated ? '1' : '0',
      '1',
    );
    // Claimed between the entry read and the re-scan — the opponent's join is
    // creating the game right now; the next poll drains the mailbox.
    if (opponentId === CLAIMED_SENTINEL) {
      return { status: 'queued', waitSeconds };
    }
    if (opponentId) {
      const preset = MATCHMAKING_TIME_CONTROLS.find(
        (p) =>
          p.seconds === Number(entry['timeControlSeconds']) &&
          p.increment === Number(entry['incrementSeconds']),
      );
      if (preset) {
        try {
          const gameId = await this.createMatchedGame(userId, opponentId, preset, rated);
          return { status: 'matched', gameId, waitSeconds };
        } catch (err) {
          if (!(err instanceof StaleCandidateError)) throw err;
          // Fall through to 'queued' — the next poll self-heals via re-join.
        }
      }
    }

    return { status: 'queued', waitSeconds };
  }

  /**
   * Best-effort queue removal for players who enter a game through a
   * non-matchmaking path (invite accept, rematch accept). Without this a
   * queued player stays claimable while already playing — and if their
   * search tab keeps polling, the status heartbeat refreshes the entry TTL
   * indefinitely. Never throws: queue hygiene must not fail game activation.
   */
  async dequeue(...userIds: Array<string | null>): Promise<void> {
    for (const userId of userIds) {
      if (!userId) continue;
      try {
        const pool = await this.redis.hget(userKey(userId), 'pool');
        if (!pool) continue;
        await this.redis.zrem(pool, userId);
        await this.redis.del(userKey(userId));
        this.posthog.captureEvent(userId, 'matchmaking_dequeued', { reason: 'entered_game' });
      } catch {
        // Redis hiccup — TTL expiry plus the in-scan reaper cover the residue.
      }
    }
  }

  /**
   * Both players are claimed out of the queue — create the Game directly
   * `active` (no invite token/pending step; the opponent is known). Engine
   * state initializes lazily on the first GET /games/:id/state, which is when
   * the clock starts — identical to the post-accept invite flow.
   */
  private async createMatchedGame(
    userId: string,
    opponentId: string,
    preset: MatchmakingTimeControl,
    rated: boolean,
  ): Promise<string> {
    // Defense in depth behind dequeue-on-activation: a player who entered a
    // game through an invite/rematch in the ms before their queue entry was
    // removed must not be paired into a second game.
    const busy = await this.prisma.game.findFirst({
      where: {
        status: 'active',
        isVsComputer: false,
        OR: [
          { whiteUserId: { in: [userId, opponentId] } },
          { blackUserId: { in: [userId, opponentId] } },
        ],
      },
      select: { id: true },
    });
    if (busy) {
      this.logger.warn(`Stale pairing dropped: ${userId} vs ${opponentId} (active game ${busy.id})`);
      throw new StaleCandidateError();
    }

    const callerIsWhite = Math.random() < 0.5;
    const whiteUserId = callerIsWhite ? userId : opponentId;
    const blackUserId = callerIsWhite ? opponentId : userId;

    let gameId: string;
    try {
      const game = await this.prisma.game.create({
        data: {
          whiteUserId,
          blackUserId,
          timeControlSeconds: preset.seconds,
          incrementSeconds: preset.increment,
          category: preset.category,
          isRated: rated,
          status: 'active',
          startedAt: new Date(),
        },
        select: { id: true },
      });
      gameId = game.id;
    } catch (err) {
      // The opponent was already claimed out of the queue; their client's
      // status poll comes back 'idle' and auto-rejoins (self-healing).
      this.logger.error(
        `Matched-game creation failed for ${userId} vs ${opponentId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }

    // Mailboxes cover a missed WS push (socket down at pair time).
    await this.redis.set(matchKey(userId), gameId, 'EX', MAILBOX_TTL_SECONDS);
    await this.redis.set(matchKey(opponentId), gameId, 'EX', MAILBOX_TTL_SECONDS);

    this.realtime.emitMatchFound(userId, {
      gameId,
      color: callerIsWhite ? 'w' : 'b',
      opponentId,
    });
    this.realtime.emitMatchFound(opponentId, {
      gameId,
      color: callerIsWhite ? 'b' : 'w',
      opponentId: userId,
    });

    for (const id of [userId, opponentId]) {
      this.posthog.captureEvent(id, 'match_found', {
        game_id: gameId,
        category: preset.category,
        time_control: preset.label,
        rated,
      });
    }
    return gameId;
  }
}
