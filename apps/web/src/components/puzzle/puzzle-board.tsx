'use client';

import { ArrowRight, CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Chessboard } from '@/components/board/chessboard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Square } from '@purechess/shared';
import type { PuzzleState } from '@/hooks/use-puzzle';
import type { LichessPuzzleData } from '@/lib/api/puzzles';
import { humanizeTheme } from '@/components/puzzle/theme-tile';

interface PuzzleBoardProps {
  state: PuzzleState;
  puzzleData: LichessPuzzleData | null;
  onMove: (uci: string) => void;
  onReveal: () => void;
  onTryAgain: () => void;
  onNext: () => void;
}

export function PuzzleBoard({
  state,
  puzzleData,
  onMove,
  onReveal,
  onTryAgain,
  onNext,
}: PuzzleBoardProps) {
  const { phase } = state;

  return (
    <div className="relative w-full">
      <Chessboard
        position={state.fen}
        orientation={state.solvingColor === 'w' ? 'white' : 'black'}
        readOnly={phase !== 'player'}
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

      {phase === 'loading' && (
        <Overlay tone="neutral">
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : (
            <Loader2 className="h-7 w-7 animate-spin text-brass" aria-label="Loading puzzle" />
          )}
        </Overlay>
      )}

      {phase === 'success' && (
        <Overlay tone="success">
          <CheckCircle2 className="h-9 w-9 text-brass" aria-hidden="true" />
          <p className="text-lg font-semibold text-foreground">Puzzle solved!</p>
          {puzzleData && puzzleData.puzzle.themes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {puzzleData.puzzle.themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full border border-brass/40 bg-brass-soft/40 px-2.5 py-0.5 text-[11px] font-medium text-brass-text"
                >
                  {humanizeTheme(theme)}
                </span>
              ))}
            </div>
          )}
          <Button
            onClick={onNext}
            className="mt-1 h-10 bg-foreground font-semibold text-background hover:bg-foreground/90"
          >
            Next puzzle
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Overlay>
      )}

      {phase === 'fail' && (
        <Overlay tone="error">
          <XCircle className="h-9 w-9 text-destructive" aria-hidden="true" />
          <p className="text-lg font-semibold text-foreground">Incorrect.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={onReveal} className="h-10">
              Show solution
            </Button>
            <Button onClick={onTryAgain} className="h-10 bg-foreground font-semibold text-background hover:bg-foreground/90">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({
  tone,
  children,
}: {
  tone: 'neutral' | 'success' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-[4px] p-6 text-center backdrop-blur-sm',
        tone === 'neutral' && 'bg-background/55',
        tone === 'success' && 'bg-background/75',
        tone === 'error' && 'bg-background/75',
      )}
    >
      {children}
    </div>
  );
}
