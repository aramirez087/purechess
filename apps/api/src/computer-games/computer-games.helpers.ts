import { TimeControlCategory } from "@prisma/client";
import {
  ComputerClockDto,
  ComputerGameStateDto,
  SerializableEngineState,
} from "@purechess/shared";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Engine clock for untimed games (timeControlSeconds <= 0). The engine's
 * isTimeout uses `remaining <= elapsed`, so a 0ms clock flags immediately —
 * untimed games instead get this ~100h sentinel, and submitMove additionally
 * resets lastTickAt on every move so the sentinel never drains.
 */
export const UNTIMED_CLOCK_MS = 359_999_000;

export function isUntimed(timeControlSeconds: number): boolean {
  return timeControlSeconds <= 0;
}

/** Milliseconds for the engine clock — sentinel for untimed games. */
export function engineTimeMs(timeControlSeconds: number): number {
  return isUntimed(timeControlSeconds)
    ? UNTIMED_CLOCK_MS
    : timeControlSeconds * 1000;
}

export function resolveColor(
  color: "white" | "black" | "random",
): "white" | "black" {
  if (color === "random") return Math.random() < 0.5 ? "white" : "black";
  return color;
}

export function getCategory(secs: number): TimeControlCategory {
  if (secs <= 0) return TimeControlCategory.rapid; // untimed — closest bucket
  if (secs < 180) return TimeControlCategory.bullet;
  if (secs <= 600) return TimeControlCategory.blitz;
  return TimeControlCategory.rapid;
}

/** Position key = first four FEN fields (piece placement, side, castling, ep). */
export function fenPositionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export interface DtoExtras {
  clock: ComputerClockDto | null;
  drawOffered: boolean;
  drawOfferedBy: "white" | "black" | null;
  abortable: boolean;
}

/**
 * Derive the optional DTO fields (clock / draw-offer / abortable) from a
 * serialized engine state. Defensive against partial states (e.g. test mocks
 * that omit clock/moves) so callers never crash on a missing field.
 */
export function computeExtras(
  serialized: SerializableEngineState | null | undefined,
  computerColor: "white" | "black",
  status: string,
): DtoExtras {
  const moves = serialized?.moves ?? [];
  const humanColorChar = computerColor === "white" ? "b" : "w";
  const humanMoves = moves.filter((m) => m.by === humanColorChar).length;

  const offerBy = serialized?.pendingDrawOfferBy ?? null;
  const drawOfferedBy =
    offerBy === "w" ? "white" : offerBy === "b" ? "black" : null;

  const c = serialized?.clock;
  // Untimed games carry the never-draining sentinel on both sides — surface
  // them as "no clock" so clients don't render a 100h countdown.
  const untimed =
    c != null && c.whiteMs >= UNTIMED_CLOCK_MS && c.blackMs >= UNTIMED_CLOCK_MS;
  const clock: ComputerClockDto | null =
    c && !untimed
      ? {
          whiteMs: c.whiteMs,
          blackMs: c.blackMs,
          lastTickAt: c.lastTickAt,
          incrementMs: c.incrementMs,
        }
      : null;

  return {
    clock,
    drawOffered: drawOfferedBy !== null,
    drawOfferedBy,
    abortable: status === "active" && humanMoves === 0,
  };
}

export interface BuildStateDtoArgs {
  gameId: string;
  fen: string;
  pgn: string | null;
  status: string;
  computerColor: "white" | "black";
  computerLevel: number;
  lastComputerMove: string | null;
  result: string | null;
  resultReason: string | null;
  extras?: DtoExtras;
}

export function buildStateDto(args: BuildStateDtoArgs): ComputerGameStateDto {
  const dto: ComputerGameStateDto = {
    gameId: args.gameId,
    fen: args.fen,
    pgn: args.pgn ?? "",
    status: args.status,
    computerColor: args.computerColor,
    computerLevel: args.computerLevel,
    lastComputerMove: args.lastComputerMove,
    result: args.result,
    resultReason: args.resultReason,
  };
  if (args.extras) {
    dto.clock = args.extras.clock;
    dto.drawOffered = args.extras.drawOffered;
    dto.drawOfferedBy = args.extras.drawOfferedBy;
    dto.abortable = args.extras.abortable;
  }
  return dto;
}

/**
 * Truncate a serialized engine state to `targetPly` moves and rebuild the
 * derived fields (fen, fenHistory, per-side clock) WITHOUT replaying moves —
 * every value comes from the surviving per-move records. Clears any stale draw
 * offer and reactivates the game. Shared by takeback and rewind.
 */
export function truncateToPly(
  serialized: SerializableEngineState,
  targetPly: number,
  game: { timeControlSeconds: number; startingFen?: string | null },
  nowMs: number,
): SerializableEngineState {
  const moves = serialized.moves.slice(0, targetPly);
  const startFen = game.startingFen ?? STARTING_FEN;
  const fen = targetPly > 0 ? moves[targetPly - 1]!.fenAfter : startFen;
  const fenHistory = serialized.fenHistory.slice(0, targetPly + 1);

  const baseMs = engineTimeMs(game.timeControlSeconds);
  let whiteMs = baseMs;
  let blackMs = baseMs;
  let whiteSet = false;
  let blackSet = false;
  for (let i = targetPly - 1; i >= 0 && !(whiteSet && blackSet); i--) {
    const m = moves[i]!;
    if (m.by === "w" && !whiteSet) {
      whiteMs = m.clockAfterMs;
      whiteSet = true;
    } else if (m.by === "b" && !blackSet) {
      blackMs = m.clockAfterMs;
      blackSet = true;
    }
  }

  return {
    ...serialized,
    fen,
    fenHistory,
    moves,
    clock: {
      whiteMs,
      blackMs,
      lastTickAt: nowMs,
      incrementMs: serialized.clock.incrementMs,
    },
    pendingDrawOfferBy: null,
    status: "active",
    result: null,
    resultReason: null,
  };
}
