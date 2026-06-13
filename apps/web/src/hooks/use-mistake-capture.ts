'use client';

import { useEffect, useRef } from 'react';
import type { MistakeCandidateDto } from '@purechess/shared';
import type { ClassificationResult, ClassifiedMove } from '@/hooks/use-move-classifier';
import { replayToFen } from '@/lib/replay';
import { saveGameMistakes } from '@/lib/api/puzzles';
import type { WireMove } from '@purechess/shared';

/**
 * Centipawn-loss floor for a move to count as a capturable mistake — mirrors the
 * server's `MISTAKE_CP_THRESHOLD`. The classifier already bands moves; we keep
 * only its `mistake`/`blunder` verdicts AND require the capped CPL to clear this
 * floor so a near-even win%-swing doesn't post a spurious "blunder".
 */
export const CAPTURE_CP_THRESHOLD = 150;

export interface UseMistakeCaptureArgs {
  /** The game whose mistakes are being captured. Capture is a no-op without it. */
  gameId: string | null | undefined;
  /** Move list (for re-deriving the position before each mistaken move). */
  moves: WireMove[];
  /** Custom start FEN, if any. */
  startFen?: string;
  /** The signed-in viewer's own side, or null when they aren't a player. */
  viewerColor: 'w' | 'b' | null;
  /** The completed classification, or null until the user runs analysis. */
  classification: ClassificationResult | null;
}

/**
 * Collects the signed-in player's OWN mistakes/blunders once the review page's
 * move-classifier finishes, then POSTs them a single time (the endpoint upserts,
 * so it is idempotent across re-runs). Fire-and-forget: a failed save never
 * surfaces to the user or blocks review. Does nothing when the viewer isn't a
 * player (e.g. a spectator or a pasted-PGN analysis) — there are no "own" moves
 * to attribute.
 *
 * The server re-derives every position and rejects anything inconsistent, so
 * this hook is a best-effort signal source, not a source of truth.
 */
export function useMistakeCapture({
  gameId,
  moves,
  startFen,
  viewerColor,
  classification,
}: UseMistakeCaptureArgs): void {
  // Guard so we POST at most once per (game, classification) — re-renders and
  // the classifier object identity changing must not re-fire the save.
  const sentForGameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameId || !viewerColor || !classification) return;
    if (sentForGameRef.current === gameId) return;

    const candidates = collectOwnMistakes(classification.moves, moves, viewerColor, startFen);
    // Mark sent regardless of payload: an empty result means "no mistakes to
    // capture for this game" — re-running classification shouldn't retry.
    sentForGameRef.current = gameId;
    if (candidates.length === 0) return;

    // Fire-and-forget — never block or surface in the review UX.
    void saveGameMistakes(gameId, candidates).catch(() => {
      // best-effort: a failed capture is silent. Allow a later retry by clearing
      // the guard so a subsequent classification run can try again.
      sentForGameRef.current = null;
    });
  }, [gameId, viewerColor, classification, moves, startFen]);
}

/**
 * Filters a classification down to the viewer's own mistake/blunder moves over
 * the capture threshold and shapes them into {@link MistakeCandidateDto}s. The
 * FEN is the position BEFORE the move (the puzzle start); the solution is the
 * engine's best move (a one-move line — the classifier exposes the best move,
 * not the full PV). Exported for unit testing.
 */
export function collectOwnMistakes(
  classified: ClassifiedMove[],
  moves: WireMove[],
  viewerColor: 'w' | 'b',
  startFen?: string,
): MistakeCandidateDto[] {
  const out: MistakeCandidateDto[] = [];
  for (const m of classified) {
    if (m.color !== viewerColor) continue;
    if (m.class !== 'mistake' && m.class !== 'blunder') continue;
    if (m.cpl < CAPTURE_CP_THRESHOLD) continue;
    if (!m.bestUci) continue; // no engine line — nothing to re-solve

    const fenBefore = replayToFen(moves, m.ply - 1, startFen);
    if (!fenBefore) continue; // corrupt record — skip

    out.push({
      ply: m.ply,
      fen: fenBefore,
      playedUci: m.uci,
      bestUci: m.bestUci,
      // The classifier exposes the single best move; a one-move solution line.
      bestLineUci: [m.bestUci],
      cpLoss: Math.round(m.cpl),
    });
  }
  return out;
}
