'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, Target, XCircle } from 'lucide-react';
import type { PuzzleDto, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { useLocalPuzzle } from '@/hooks/use-local-puzzle';
import { fetchMistakes, markMistakeReviewed } from '@/lib/api/puzzles';
import { cn } from '@/lib/utils';

/**
 * One detected mistake to drill. Derived from the client classification on the
 * review page (the position BEFORE the blunder + the engine's best line). The
 * server-persisted id is resolved lazily by ply so solving can mark it reviewed.
 */
export interface MistakeItem {
  /** 1-based ply of the mistaken move. */
  ply: number;
  /** Move number label, e.g. "17". */
  moveNumber: number;
  /** Side that played it. */
  color: 'w' | 'b';
  /** SAN of the move actually played, e.g. "Qd2". */
  san: string;
  /** Position BEFORE the blunder — the solve starts here. */
  fen: string;
  /** Engine best line to re-solve, UCI (≥ 1 move). */
  bestLineUci: string[];
  /** Centipawns lost (for the "−3.4" readout). */
  cpLoss: number;
}

export interface MistakeTrainerProps {
  gameId: string;
  /** This game's detected own-side mistakes (already filtered + sorted by ply). */
  mistakes: MistakeItem[];
}

/** Pawns lost, signed, one decimal: cpLoss 340 → "−3.4". */
function formatLoss(cpLoss: number): string {
  return `−${(cpLoss / 100).toFixed(1)}`;
}

/** Build a one-puzzle DTO from a mistake: fen = before-blunder, moves = best line. */
function mistakeToPuzzle(m: MistakeItem): PuzzleDto {
  return {
    id: `mistake-${m.ply}`,
    fen: m.fen,
    moves: m.bestLineUci,
    rating: 0,
    themes: [],
  };
}

/**
 * "Solve your own mistake" panel on the review page. Lists this game's detected
 * blunders; clicking one drops into an inline solve from the position BEFORE the
 * move ("find the move you missed"), reusing {@link useLocalPuzzle} — the same
 * solve core as rush and review. Solving marks the mistake reviewed server-side
 * (best-effort; the id is resolved by ply from the persisted backlog).
 *
 * Self-hides when there are no mistakes to drill (a clean game, or analysis not
 * run yet). Purely additive on the review page — touches no existing behaviour.
 */
export function MistakeTrainer({ gameId, mistakes }: MistakeTrainerProps) {
  const [activePly, setActivePly] = useState<number | null>(null);
  // Plies already re-solved this session — drives the inline "Solved" check.
  const [solved, setSolved] = useState<Set<number>>(() => new Set());
  // Lazily-resolved map of ply → persisted GameMistake id (for markReviewed).
  const idByPlyRef = useRef<Map<number, string>>(new Map());

  // Resolve persisted ids once so solving can mark the right row reviewed. The
  // capture POST is fire-and-forget, so ids may not exist yet — that's fine, the
  // mark-reviewed call is itself best-effort.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchMistakes(false);
        if (cancelled) return;
        const map = new Map<number, string>();
        for (const r of rows) if (r.gameId === gameId) map.set(r.ply, r.id);
        idByPlyRef.current = map;
      } catch {
        // best-effort — list stays empty, marking is skipped.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const active = useMemo(
    () => mistakes.find((m) => m.ply === activePly) ?? null,
    [mistakes, activePly],
  );

  if (mistakes.length === 0) return null;

  return (
    <section
      aria-label="Train your mistakes"
      data-testid="mistake-trainer"
      className="rounded-[10px] border border-[#2b332c] bg-[#0b0d0b]/40"
    >
      <header className="flex items-center gap-2 border-b border-[#2b332c] px-3 py-2">
        <Target className="h-3.5 w-3.5 text-[#d6b563]" aria-hidden="true" />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#c7cfc4]">
          Train your mistakes
        </h3>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-[#8a948a]">
          {solved.size}/{mistakes.length}
        </span>
      </header>

      {active ? (
        <MistakeSolve
          key={active.ply}
          mistake={active}
          solved={solved.has(active.ply)}
          onBack={() => setActivePly(null)}
          onSolved={() => {
            setSolved((prev) => new Set(prev).add(active.ply));
            const id = idByPlyRef.current.get(active.ply);
            if (id) {
              // Best-effort: a failed mark never blocks the solve feedback.
              void markMistakeReviewed(id).catch(() => {});
            }
          }}
        />
      ) : (
        <ul className="flex flex-col">
          {mistakes.map((m) => (
            <li key={m.ply}>
              <button
                type="button"
                onClick={() => setActivePly(m.ply)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-inset"
              >
                {solved.has(m.ply) ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#d6b563]" aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c2563f]"
                  />
                )}
                <span className="min-w-0 truncate text-[13px] text-[#e7e3d6]">
                  Move {m.moveNumber}.{m.color === 'b' ? '..' : ''} {m.san}
                </span>
                <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-[#c2563f]">
                  {formatLoss(m.cpLoss)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Inline solve for a single mistake. Reuses the shared local-puzzle solve loop. */
function MistakeSolve({
  mistake,
  solved,
  onBack,
  onSolved,
}: {
  mistake: MistakeItem;
  solved: boolean;
  onBack: () => void;
  onSolved: () => void;
}) {
  const puzzle = useMemo(() => mistakeToPuzzle(mistake), [mistake]);
  const [outcome, setOutcome] = useState<'solved' | 'failed' | null>(
    solved ? 'solved' : null,
  );

  const handleSolved = useCallback(() => {
    setOutcome('solved');
    onSolved();
  }, [onSolved]);
  const handleFailed = useCallback(() => setOutcome('failed'), []);

  const { state, onMove } = useLocalPuzzle({
    puzzle,
    onSolved: handleSolved,
    onFailed: handleFailed,
  });

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[#2b332c] bg-[#0b0d0b]/40 px-2 text-xs font-medium text-[#c7cfc4] transition-colors hover:border-[#3a443b] hover:text-[#f1eee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563]"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Mistakes
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#8a948a]">
          Move {mistake.moveNumber}.{mistake.color === 'b' ? '..' : ''} {mistake.san}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[300px]">
        <Chessboard
          position={state.fen}
          orientation={state.solvingColor === 'w' ? 'white' : 'black'}
          readOnly={state.phase !== 'player'}
          lastMove={
            state.lastMove
              ? { from: state.lastMove[0] as Square, to: state.lastMove[1] as Square }
              : undefined
          }
          onMove={(m) => {
            if (!m.from || !m.to) return;
            onMove(m.from + m.to + (m.promotion ?? ''));
          }}
        />
        {outcome === 'solved' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 rounded-[4px] bg-[#0b0d0b]/75 text-center backdrop-blur-sm">
            <CheckCircle2 className="h-7 w-7 text-[#d6b563]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#f1eee6]">You found it</p>
          </div>
        )}
        {outcome === 'failed' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 rounded-[4px] bg-[#0b0d0b]/75 text-center backdrop-blur-sm">
            <XCircle className="h-7 w-7 text-[#c2563f]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#f1eee6]">Not the move — try again</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-1 text-xs text-[#c7cfc4] underline-offset-2 hover:underline"
            >
              Back to list
            </button>
          </div>
        )}
      </div>

      <p
        className={cn(
          'min-h-[1.1rem] text-center text-[13px] text-[#9da79c]',
          outcome && 'opacity-0',
        )}
      >
        Find the move you missed.
      </p>
    </div>
  );
}
