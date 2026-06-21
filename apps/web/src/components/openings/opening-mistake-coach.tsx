'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Target,
  XCircle,
} from 'lucide-react';
import type { ChessComOpeningMistakeDto } from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { GameRailButton } from '@/components/game/game-rail-button';
import { Overlay, PuzzleBoardPane } from '@/components/puzzle/solve-session-shell';
import { Button } from '@/components/ui/button';
import { useLocalPuzzle } from '@/hooks/use-local-puzzle';
import {
  fetchChessComMistakes,
  markChessComMistakeReviewed,
} from '@/lib/api/chess-com';
import { bestMoveArrow } from '@/lib/board/annotations';
import { solvingColorFromFen } from '@/lib/board/puzzle-utils';
import {
  chessComMistakeToPuzzle,
  cpLossCoachLine,
  mistakeCoachTitle,
  moveLabel,
  plyMeta,
} from '@/lib/chess-com/mistake-coach';
import { openingLabHref } from '@/lib/openings/opening-deep-link';
import { cn } from '@/lib/utils';

type CoachStep = 'learn' | 'practice' | 'done';

export interface OpeningMistakeCoachProps {
  gameId: string;
  ply: number;
}

export function OpeningMistakeCoach({ gameId, ply }: OpeningMistakeCoachProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<CoachStep>('learn');

  const mistakes = useQuery({
    queryKey: ['chess-com-mistakes'],
    queryFn: fetchChessComMistakes,
  });

  const mistake = useMemo(
    () => mistakes.data?.mistakes.find((m) => m.gameId === gameId && m.ply === ply) ?? null,
    [mistakes.data?.mistakes, gameId, ply],
  );

  const markReviewed = useMutation({
    mutationFn: () => markChessComMistakeReviewed(gameId, ply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chess-com-mistakes'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  if (mistakes.isLoading) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Loading your mistake…</p>
    );
  }

  if (!mistake) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find that mistake — it may have been reviewed already or removed after a
          re-sync.
        </p>
        <Button asChild>
          <Link href="/openings">Back to openings</Link>
        </Button>
      </div>
    );
  }

  return (
    <OpeningMistakeCoachBody
      mistake={mistake}
      step={step}
      onStepChange={setStep}
      onBack={() => router.push('/openings')}
      onReviewed={() => {
        void markReviewed.mutateAsync().catch(() => {});
        setStep('done');
      }}
    />
  );
}

function OpeningMistakeCoachBody({
  mistake,
  step,
  onStepChange,
  onBack,
  onReviewed,
}: {
  mistake: ChessComOpeningMistakeDto;
  step: CoachStep;
  onStepChange: (step: CoachStep) => void;
  onBack: () => void;
  onReviewed: () => void;
}) {
  const openingName = mistakeCoachTitle(mistake);
  const { moveNumber, color } = plyMeta(mistake.ply);
  const sideLabel = color === 'w' ? 'White' : 'Black';
  const labHref = openingLabHref(openingName, mistake.fen);

  return (
    <div className="opening-mistake-shell [--board-reserve:16rem] mx-auto flex w-full max-w-[1760px] flex-1 flex-col px-4 pb-6 sm:px-6 lg:min-h-0 lg:overflow-hidden lg:py-4">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between lg:pb-3">
        <div className="flex items-center gap-3">
          <GameRailButton size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Your mistakes
          </GameRailButton>
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass-text">
              Opening coach · {step === 'learn' ? '1' : step === 'practice' ? '2' : '✓'} of 2
            </span>
            <h1 className="truncate font-display text-2xl italic text-foreground sm:text-3xl">
              {openingName}
            </h1>
          </div>
        </div>
        <a
          href={mistake.gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View game on chess.com
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </header>

      {step === 'learn' ? (
        <LearnStep
          mistake={mistake}
          openingName={openingName}
          moveNumber={moveNumber}
          sideLabel={sideLabel}
          onPractice={() => onStepChange('practice')}
        />
      ) : null}

      {step === 'practice' ? (
        <PracticeStep
          mistake={mistake}
          onBack={() => onStepChange('learn')}
          onSolved={onReviewed}
        />
      ) : null}

      {step === 'done' ? (
        <DoneStep mistake={mistake} openingName={openingName} labHref={labHref} onBack={onBack} />
      ) : null}
    </div>
  );
}

function CoachBoardColumn({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="order-1 flex min-h-0 min-w-0 flex-col gap-3 lg:order-none lg:h-full">
      <div className="flex min-h-0 flex-1 items-center justify-center py-1 lg:py-0">
        <div className="aspect-square w-full max-w-[min(100%,calc(100dvh-var(--board-reserve,16rem)))]">
          {children}
        </div>
      </div>
      {footer}
    </div>
  );
}

function LearnStep({
  mistake,
  openingName,
  moveNumber,
  sideLabel,
  onPractice,
}: {
  mistake: ChessComOpeningMistakeDto;
  openingName: string;
  moveNumber: number;
  sideLabel: string;
  onPractice: () => void;
}) {
  const orientation = solvingColorFromFen(mistake.fen) === 'w' ? 'white' : 'black';
  const playedArrow = bestMoveArrow(mistake.playedUci, 'red');
  const bestArrow = bestMoveArrow(mistake.bestUci, 'green');
  const autoShapes = [playedArrow, bestArrow].filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:mt-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-center lg:gap-6 lg:overflow-hidden">
      <BoardSettingsProvider>
        <CoachBoardColumn
          footer={
            <>
              <ArrowLegend playedSan={mistake.playedSan} bestSan={mistake.bestSan} />
              <p className="shrink-0 text-center text-xs text-muted-foreground">
                {moveLabel(mistake.ply, mistake.playedSan)} in your game
              </p>
            </>
          }
        >
          <Chessboard
            position={mistake.fen}
            orientation={orientation}
            readOnly
            autoShapes={autoShapes}
          />
        </CoachBoardColumn>
      </BoardSettingsProvider>

      <section className="order-2 flex min-h-0 flex-col gap-4 rounded-[12px] border border-brass/35 bg-brass-soft/10 p-5 shadow-elevated lg:max-h-full lg:overflow-y-auto">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brass/15 text-brass-text">
            <Lightbulb className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-3">
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-medium">Here&apos;s what happened</span> in your chess.com game
              during the <span className="font-medium">{openingName}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              On move {moveNumber}, you were playing as{' '}
              <span className="font-medium text-foreground">{sideLabel}</span>. The board is the
              exact position <span className="italic">before</span> you moved.
            </p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <CoachFact
            tone="bad"
            label="You played"
            value={mistake.playedSan}
            hint="Red arrow on the board"
          />
          <CoachFact
            tone="good"
            label="Stronger was"
            value={mistake.bestSan ?? 'see green arrow'}
            hint="Green arrow on the board"
          />
        </dl>

        <p className="rounded-[8px] border border-border/70 bg-background/40 px-3 py-2.5 text-sm text-muted-foreground">
          {cpLossCoachLine(mistake.cpLoss)}
          <span className="ml-1 font-mono text-xs text-foreground/80">({mistake.cpLoss}cp)</span>
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onPractice} className="gap-1.5">
            <Target className="h-4 w-4" aria-hidden="true" />
            Let me try the better move
          </Button>
        </div>
      </section>
    </div>
  );
}

function PracticeStep({
  mistake,
  onBack,
  onSolved,
}: {
  mistake: ChessComOpeningMistakeDto;
  onBack: () => void;
  onSolved: () => void;
}) {
  const puzzle = useMemo(() => chessComMistakeToPuzzle(mistake), [mistake]);
  const [outcome, setOutcome] = useState<'solved' | 'failed' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const bestArrow = bestMoveArrow(mistake.bestUci, 'green');
  const hintShapes = showAnswer && bestArrow ? [bestArrow] : undefined;

  const handleSolved = useCallback(() => {
    setOutcome('solved');
    onSolved();
  }, [onSolved]);
  const handleFailed = useCallback(() => setOutcome('failed'), []);

  const { state, onMove, onReveal } = useLocalPuzzle({
    puzzle,
    onSolved: handleSolved,
    onFailed: handleFailed,
  });

  const { moveNumber, color } = plyMeta(mistake.ply);

  const boardFooter =
    outcome === 'failed' && bestArrow ? (
      <p className="shrink-0 text-center text-xs text-muted-foreground">
        Hint: the green arrow shows {mistake.bestSan ?? 'the engine move'} after you reveal.
      </p>
    ) : (
      <p className="min-h-[1.25rem] shrink-0 text-center text-sm text-muted-foreground">
        {state.phase === 'player' && !outcome ? (
          <>
            Drag a piece or tap a square — it&apos;s{' '}
            <span className="font-medium text-foreground">
              {state.solvingColor === 'w' ? 'White' : 'Black'}
            </span>
            &apos;s turn.
          </>
        ) : (
          ' '
        )}
      </p>
    );

  return (
    <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:mt-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-center lg:gap-6 lg:overflow-hidden">
      <BoardSettingsProvider>
        <CoachBoardColumn footer={boardFooter}>
          <PuzzleBoardPane
            state={state}
            onMove={onMove}
            autoShapes={hintShapes}
            className="mx-0 h-full max-w-none"
          >
            {outcome === 'solved' ? (
              <Overlay tone="success">
                <CheckCircle2 className="h-8 w-8 text-brass" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">That&apos;s the one!</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  You found {mistake.bestSan ?? 'the better move'} — the same move you missed in your
                  game.
                </p>
              </Overlay>
            ) : null}
            {outcome === 'failed' && !showAnswer ? (
              <Overlay tone="error">
                <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground">Not quite</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Tap &ldquo;Show the correct move&rdquo; to see the green arrow, then try again.
                </p>
              </Overlay>
            ) : null}
          </PuzzleBoardPane>
        </CoachBoardColumn>
      </BoardSettingsProvider>

      <section className="order-2 flex min-h-0 flex-col gap-4 rounded-[12px] border border-border/70 bg-surface/60 p-5 lg:max-h-full lg:overflow-y-auto">
        <div className="flex items-center gap-2">
          <GameRailButton size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Explanation
          </GameRailButton>
        </div>
        <h2 className="font-medium text-foreground">Your turn — find the move you missed</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Same position from your game (move {moveNumber}
          {color === 'b' ? ', Black' : ''}). Play the move the engine wanted instead of{' '}
          <span className="font-mono text-foreground">{mistake.playedSan}</span>.
        </p>
        {mistake.bestSan ? (
          <p className="text-sm text-muted-foreground">
            Stuck? The answer is{' '}
            <span className="font-mono font-medium text-brass-text">{mistake.bestSan}</span> — but
            try to find it on the board first.
          </p>
        ) : null}
        {outcome === 'failed' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAnswer(true);
              onReveal();
            }}
            className="self-start"
          >
            Show the correct move
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function DoneStep({
  mistake,
  openingName,
  labHref,
  onBack,
}: {
  mistake: ChessComOpeningMistakeDto;
  openingName: string;
  labHref: string;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto mt-4 flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 rounded-[12px] border border-brass/40 bg-brass-soft/12 p-8 text-center shadow-elevated lg:mt-3">
      <CheckCircle2 className="h-10 w-10 text-brass" aria-hidden="true" />
      <div className="space-y-2">
        <h2 className="font-display text-2xl italic text-foreground">Well done</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You replayed the move you missed in your {openingName} game
          {mistake.bestSan ? (
            <>
              {' '}
              — <span className="font-mono text-foreground">{mistake.bestSan}</span>
            </>
          ) : null}
          . We&apos;ll mark this mistake reviewed.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onBack}>Back to your mistakes</Button>
        <Button asChild variant="outline">
          <Link href={labHref}>
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            Study {openingName} in Lab
          </Link>
        </Button>
      </div>
    </section>
  );
}

function CoachFact({
  tone,
  label,
  value,
  hint,
}: {
  tone: 'good' | 'bad';
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[10px] border px-3 py-2.5',
        tone === 'bad'
          ? 'border-destructive/35 bg-destructive/8'
          : 'border-brass/40 bg-brass/10',
      )}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg text-foreground">{value}</dd>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ArrowLegend({
  playedSan,
  bestSan,
}: {
  playedSan: string;
  bestSan?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-5 rounded-full bg-red-500" aria-hidden="true" />
        Your move ({playedSan})
      </span>
      {bestSan ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-emerald-500" aria-hidden="true" />
          Better ({bestSan})
        </span>
      ) : null}
    </div>
  );
}