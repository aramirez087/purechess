import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { GameMistakeDto, MistakeCandidateDto } from '@purechess/shared';
import { PrismaService } from '../database/prisma.service';

/**
 * Centipawn-loss floor for a move to count as a persistable mistake. Matches
 * the client classifier's mistake/blunder bands (a "mistake" is a real eval
 * swing, not search noise). Anything below this is an inaccuracy/good move and
 * is never written. Exported so the controller, tests, and S12 read one value.
 */
export const MISTAKE_CP_THRESHOLD = 150;

/** Standard initial position — the position before ply 1 when a game has no custom start. */
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Compare two FENs on the placement+turn+castling+ep fields only (ignore clocks). */
function fenMatches(a: string, b: string): boolean {
  return a.split(' ').slice(0, 4).join(' ') === b.split(' ').slice(0, 4).join(' ');
}

/**
 * Persists and serves blunders lifted from a user's OWN games. The client
 * move-classifier (web) detects these; this service is the server-authoritative
 * gate: it re-derives every claimed position from the persisted Move rows and
 * rejects anything inconsistent, so a malicious client can't fabricate a mistake
 * (or attach one to a game it didn't play).
 *
 * GameMistake has NO spaced-repetition columns (the schema is frozen after S01),
 * so "mistake review" is modelled as a BACKLOG of unreviewed rows ordered by
 * recency — NOT a PuzzleReview card (that table's `puzzleId` is an FK to the
 * Puzzle bank; a synthetic id would violate it). {@link getDueMistakes} surfaces
 * that backlog so the review surface can union it with the SM-2 queue at the
 * page level. Solving a mistake inline flips `reviewed` (see {@link markReviewed}).
 */
@Injectable()
export class GameMistakeService {
  private readonly logger = new Logger(GameMistakeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts the user's OWN over-threshold mistakes from one game, idempotently
   * (unique gameId+ply+userId). Every candidate is server-verified against the
   * persisted game before it is written:
   *
   *   1. The game must exist and the user must be one of its two players.
   *   2. The mistaken move at `ply` must have been played by THIS user's side.
   *   3. The claimed `fen` (position before the move) must equal the FEN the
   *      server re-derives from the stored Move rows (placement/turn/castling/ep).
   *   4. The claimed `playedUci` must equal the move actually recorded at `ply`.
   *   5. `cpLoss` must clear {@link MISTAKE_CP_THRESHOLD}.
   *
   * Any candidate that fails is skipped (logged at debug), never throwing — one
   * spoofed/stale row must not drop the legitimate ones. Returns the count saved.
   */
  async saveMistakes(
    userId: string,
    gameId: string,
    candidates: MistakeCandidateDto[],
  ): Promise<number> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        whiteUserId: true,
        blackUserId: true,
        startingFen: true,
        moves: {
          select: { ply: true, uci: true, fenAfterMove: true },
          orderBy: { ply: 'asc' },
        },
      },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.whiteUserId !== userId && game.blackUserId !== userId) {
      throw new ForbiddenException('Not your game');
    }

    // The user's side: 'w' moves on odd plies (1,3,5…), 'b' on even plies.
    const userIsWhite = game.whiteUserId === userId;

    // Index Move rows by ply for O(1) re-derivation lookups.
    const movesByPly = new Map<number, { uci: string; fenAfterMove: string }>();
    for (const m of game.moves) movesByPly.set(m.ply, m);
    const startFen = game.startingFen ?? STARTING_FEN;

    let saved = 0;
    for (const c of candidates) {
      if (c.cpLoss < MISTAKE_CP_THRESHOLD) continue;

      // The mover's side is fixed by ply parity (ply 1 = White's first move).
      const moverIsWhite = c.ply % 2 === 1;
      if (moverIsWhite !== userIsWhite) continue; // not the user's own move

      const playedMove = movesByPly.get(c.ply);
      if (!playedMove) continue; // ply not in the game — bogus claim

      // Position BEFORE ply P is the FEN AFTER ply P-1 (or the game start at P=1).
      const prev = c.ply > 1 ? movesByPly.get(c.ply - 1) : undefined;
      const derivedFenBefore = c.ply === 1 ? startFen : prev?.fenAfterMove;
      if (!derivedFenBefore) continue; // gap in the record — can't verify

      // Anti-spoof: the client's claimed position + move must match the record.
      if (!fenMatches(c.fen, derivedFenBefore)) continue;
      if (c.playedUci !== playedMove.uci) continue;

      await this.prisma.gameMistake.upsert({
        where: { gameId_ply_userId: { gameId, ply: c.ply, userId } },
        create: {
          userId,
          gameId,
          ply: c.ply,
          fen: derivedFenBefore, // store the server-derived FEN, not the client's
          playedUci: playedMove.uci,
          bestUci: c.bestUci,
          bestLineUci: c.bestLineUci,
          cpLoss: c.cpLoss,
          themeGuess: c.themeGuess ?? [],
        },
        // Re-reviewing a game refreshes the engine line but never un-reviews it.
        update: {
          bestUci: c.bestUci,
          bestLineUci: c.bestLineUci,
          cpLoss: c.cpLoss,
          themeGuess: c.themeGuess ?? [],
        },
      });
      saved++;
    }

    return saved;
  }

  /** The user's mistakes, newest first. Filter to the unreviewed backlog with `unreviewedOnly`. */
  async listMistakes(
    userId: string,
    opts: { unreviewedOnly?: boolean } = {},
  ): Promise<GameMistakeDto[]> {
    const rows = await this.prisma.gameMistake.findMany({
      where: { userId, ...(opts.unreviewedOnly ? { reviewed: false } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toMistakeDto);
  }

  /**
   * The unreviewed-mistake backlog as review items, oldest-first (drill the
   * oldest unsolved blunder first — same ordering instinct as the SM-2 queue's
   * "most overdue first"). This is the union seam for the review surface: the
   * page can merge these with {@link PuzzleReviewService.getDue}. Capped by
   * `limit`. Uses the `@@index([userId, createdAt])`.
   */
  async getDueMistakes(userId: string, limit = 20): Promise<GameMistakeDto[]> {
    const rows = await this.prisma.gameMistake.findMany({
      where: { userId, reviewed: false },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map(toMistakeDto);
  }

  /**
   * Mark a mistake reviewed (the user re-solved it). Scoped to the owner via the
   * (id, userId) filter so a user can only flip their own rows. Returns the next
   * unreviewed mistake (oldest-first) so the caller can chain a solve session, or
   * null when the backlog is empty.
   */
  async markReviewed(userId: string, mistakeId: string): Promise<GameMistakeDto | null> {
    const result = await this.prisma.gameMistake.updateMany({
      where: { id: mistakeId, userId },
      data: { reviewed: true },
    });
    if (result.count === 0) {
      throw new NotFoundException('Mistake not found');
    }
    const next = await this.prisma.gameMistake.findFirst({
      where: { userId, reviewed: false },
      orderBy: { createdAt: 'asc' },
    });
    return next ? toMistakeDto(next) : null;
  }
}

/** Maps a Prisma GameMistake row to the public {@link GameMistakeDto}. */
function toMistakeDto(m: {
  id: string;
  gameId: string;
  ply: number;
  fen: string;
  playedUci: string;
  bestUci: string;
  bestLineUci: string[];
  cpLoss: number;
  themeGuess: string[];
  reviewed: boolean;
  createdAt: Date;
}): GameMistakeDto {
  return {
    id: m.id,
    gameId: m.gameId,
    ply: m.ply,
    fen: m.fen,
    playedUci: m.playedUci,
    bestUci: m.bestUci,
    bestLineUci: m.bestLineUci,
    cpLoss: m.cpLoss,
    themeGuess: m.themeGuess,
    reviewed: m.reviewed,
    createdAt: m.createdAt.toISOString(),
  };
}
