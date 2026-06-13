'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Castle,
  Check,
  Crown,
  Lightbulb,
  RotateCcw,
  Target,
  X,
} from 'lucide-react';
import type {
  EndgameCategoryDto,
  EndgameDrillDto,
  MoveIntent,
} from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { Button } from '@/components/ui/button';
import { bestMoveArrow, type BoardShape } from '@/lib/board/annotations';
import { getBestMove } from '@/lib/engine/stockfish-client';
import {
  listEndgameDrills,
  probeEndgame,
  recordEndgameAttempt,
} from '@/lib/api/endgames';
import {
  useEndgameDrill,
  type EndgameFailReason,
} from '@/hooks/use-endgame-drill';
import { cn } from '@/lib/utils';

/** Stockfish fallback defender: tough play at a high movetime. */
const ENGINE_LEVEL = 8;
const ENGINE_MOVETIME_MS = 2000;

const CATEGORY_ORDER: EndgameCategoryDto[] = [
  'basic_mate',
  'king_pawn',
  'rook',
  'minor',
  'queen',
  'other',
];

const CATEGORY_LABELS: Record<EndgameCategoryDto, string> = {
  basic_mate: 'Basic mates',
  king_pawn: 'King and pawn',
  rook: 'Rook endings',
  minor: 'Minor pieces',
  queen: 'Queen endings',
  other: 'Other',
};

type View = { kind: 'list' } | { kind: 'practice'; slug: string };

/** A small pass/fail/untried marker for a drill row. */
function StatusTick({ drill }: { drill: EndgameDrillDto }) {
  if (drill.solved) {
    return (
      <span className="inline-flex items-center gap-1 text-success" title="Passed">
        <Check className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Passed</span>
      </span>
    );
  }
  if (drill.attempted) {
    return (
      <span className="inline-flex items-center gap-1 text-warning" title="Attempted, not yet passed">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Attempted, not yet passed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground/50" title="Not attempted">
      <span aria-hidden="true" className="h-2 w-2 rounded-full ring-1 ring-border" />
      <span className="sr-only">Not attempted</span>
    </span>
  );
}

function ObjectiveBadge({ objective }: { objective: 'win' | 'draw' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        objective === 'win'
          ? 'border-brass/40 bg-brass/10 text-brass'
          : 'border-border bg-background text-muted-foreground',
      )}
    >
      {objective === 'win' ? (
        <Crown className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Castle className="h-3 w-3" aria-hidden="true" />
      )}
      {objective === 'win' ? 'Win' : 'Hold'}
    </span>
  );
}

/** The categorized list of drills with pass/fail ticks. */
function DrillList({
  drills,
  onPractice,
}: {
  drills: EndgameDrillDto[];
  onPractice: (slug: string) => void;
}) {
  const byCategory = useMemo(() => {
    const map = new Map<EndgameCategoryDto, EndgameDrillDto[]>();
    for (const d of drills) {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return map;
  }, [drills]);

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
        <section key={category} aria-labelledby={`cat-${category}`}>
          <h2
            id={`cat-${category}`}
            className="mb-3 font-display text-lg italic text-foreground"
          >
            {CATEGORY_LABELS[category]}
          </h2>
          <ul className="space-y-2">
            {(byCategory.get(category) ?? []).map((drill) => (
              <li key={drill.id}>
                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface/60 px-4 py-3 transition-colors hover:border-brass/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusTick drill={drill} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{drill.name}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ObjectiveBadge objective={drill.objective} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPractice(drill.slug)}
                      data-testid={`practice-${drill.slug}`}
                    >
                      <Target className="h-4 w-4" aria-hidden="true" />
                      Practice
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const FAIL_MESSAGES: Record<NonNullable<EndgameFailReason>, string> = {
  'threw-win': 'That throws the win — try again.',
  'lost-draw': 'That loses the draw — try again.',
  mated: 'You were checkmated — try again.',
};

/** The practice board for one drill, driven by useEndgameDrill. */
function PracticeBoard({
  drill,
  signedOut,
  onBack,
}: {
  drill: EndgameDrillDto;
  signedOut: boolean;
  onBack: () => void;
}) {
  const [restartKey, setRestartKey] = useState(0);

  const engineMoveFn = useCallback(
    (fen: string) => getBestMove(fen, ENGINE_LEVEL, ENGINE_MOVETIME_MS),
    [],
  );

  const handleComplete = useCallback(
    (result: { succeeded: boolean; movesPlayed: number }) => {
      if (signedOut) return;
      // Fire-and-forget: the attempt record never blocks the drill UI.
      recordEndgameAttempt(drill.slug, {
        succeeded: result.succeeded,
        movesPlayed: result.movesPlayed,
      }).catch(() => {
        // best-effort
      });
    },
    [drill.slug, signedOut],
  );

  const { state, onMove, onRevealBest } = useEndgameDrill({
    // Remounting (restartKey) re-seeds the hook with the same drill cleanly.
    drill,
    probeFn: (fen) => probeEndgame(drill.slug, fen),
    engineMoveFn,
    onComplete: handleComplete,
  });

  const handleMove = useCallback((intent: MoveIntent) => void onMove(intent), [onMove]);

  const autoShapes = useMemo<BoardShape[]>(() => {
    if (!state.bestMove) return [];
    const arrow = bestMoveArrow(state.bestMove, 'green');
    return arrow ? [arrow] : [];
  }, [state.bestMove]);

  const isOver = state.phase === 'success' || state.phase === 'fail';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All endgames
        </button>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl italic text-foreground">{drill.name}</h2>
          <ObjectiveBadge objective={drill.objective} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="mx-auto w-full max-w-[460px] space-y-3">
          <div
            className="flex items-center justify-between gap-3 text-sm"
            role="status"
            aria-live="polite"
          >
            <span
              className={cn(
                'inline-flex items-center gap-2 font-medium',
                state.phase === 'fail'
                  ? 'text-destructive'
                  : state.phase === 'success'
                    ? 'text-success'
                    : 'text-foreground',
              )}
            >
              {state.phase === 'success' ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {drill.objective === 'win' ? 'Converted — well done.' : 'Held the draw — well done.'}
                </>
              ) : state.phase === 'fail' ? (
                <>
                  <X className="h-4 w-4" aria-hidden="true" />
                  {state.failReason ? FAIL_MESSAGES[state.failReason] : 'Try again.'}
                </>
              ) : state.phase === 'defending' ? (
                'Defending…'
              ) : drill.objective === 'win' ? (
                'Convert the win against perfect defence.'
              ) : (
                'Hold the draw against perfect play.'
              )}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {state.movesPlayed} move{state.movesPlayed === 1 ? '' : 's'}
            </span>
          </div>

          <BoardSettingsProvider>
            <Chessboard
              key={`${drill.slug}-${restartKey}`}
              position={state.fen}
              orientation={state.userColor}
              onMove={handleMove}
              readOnly={isOver || state.phase === 'defending'}
              lastMove={
                state.lastMove
                  ? { from: state.lastMove[0] as never, to: state.lastMove[1] as never }
                  : undefined
              }
              autoShapes={autoShapes}
            />
          </BoardSettingsProvider>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[10px] border border-border bg-surface/60 p-4 text-sm">
            <p className="font-medium text-foreground">{drill.name}</p>
            <p className="mt-1 text-muted-foreground">
              {drill.objective === 'win'
                ? 'Mate the lone king. The defender plays the toughest resistance.'
                : 'Hold the draw. The defender tries every way to win.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {!isOver && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onRevealBest()}
                data-testid="reveal-best"
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" /> Show best move
              </Button>
            )}
            {isOver && (
              <Button
                onClick={() => setRestartKey((k) => k + 1)}
                data-testid="drill-retry"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
              </Button>
            )}
          </div>

          {signedOut && (
            <p className="text-xs text-muted-foreground">
              <Link href="/login?return=/endgames" className="text-brass hover:underline">
                Sign in
              </Link>{' '}
              to track which endgames you have passed.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * The Endgames surface: a categorized list of must-know drills with pass/fail
 * ticks, and a practice board that converts (or holds) against PERFECT defense.
 *
 * Reuses the app's `<Chessboard>` and client Stockfish verbatim. The defender's
 * reply comes from the cached server tablebase (`probeEndgame`) when the
 * position is in it, else Stockfish at a high movetime. Throwing the win is
 * caught the instant it happens. The drill list is public; pass/fail status and
 * attempt recording require a session.
 */
export function EndgamesClient({ signedOut }: { signedOut: boolean }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ kind: 'list' });

  const drillsQuery = useQuery({
    queryKey: ['endgame-drills'],
    queryFn: listEndgameDrills,
  });

  // Refresh statuses when returning to the list (an attempt may have landed).
  const backToList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['endgame-drills'] });
    setView({ kind: 'list' });
  }, [queryClient]);

  const drills = drillsQuery.data ?? [];

  if (view.kind === 'practice') {
    const drill = drills.find((d) => d.slug === view.slug);
    if (!drill) {
      // Drill list not loaded yet (deep state) — bounce back to the list.
      return <p className="py-10 text-center text-sm text-muted-foreground">Loading drill…</p>;
    }
    return <PracticeBoard drill={drill} signedOut={signedOut} onBack={backToList} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl italic text-foreground">Endgames</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Convert the won positions and hold the drawn ones — against perfect play. Throwing the
          win is caught the instant it happens.
        </p>
      </div>

      {drillsQuery.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading endgames…</p>
      ) : drills.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-surface/40 p-10 text-center">
          <Castle className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium text-foreground">No drills available</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            The endgame bank has not been seeded yet.
          </p>
        </div>
      ) : (
        <DrillList drills={drills} onPractice={(slug) => setView({ kind: 'practice', slug })} />
      )}
    </div>
  );
}
