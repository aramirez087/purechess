'use client';

import type { RefObject } from 'react';
import type { Square } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { cn } from '@/lib/utils';

export type SolveState = {
  fen: string;
  solvingColor: 'w' | 'b';
  phase: string;
  lastMove: [string, string] | null;
};

export interface PuzzleBoardPaneProps {
  state: SolveState;
  boardWrapRef: RefObject<HTMLDivElement>;
  onMove: (uci: string) => void;
  /** Overlay(s) to render inside the board frame (loading, error, outcome). */
  children?: React.ReactNode;
}

export function PuzzleBoardPane({ state, boardWrapRef, onMove, children }: PuzzleBoardPaneProps) {
  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="relative w-full" ref={boardWrapRef}>
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
        {children}
      </div>
    </div>
  );
}

export interface PuzzlePromptProps {
  phase: string;
  solvingColor: 'w' | 'b';
  hasOutcome: boolean;
}

export function PuzzlePrompt({ phase, solvingColor, hasOutcome }: PuzzlePromptProps) {
  return (
    <p className="min-h-[1.25rem] text-center text-sm text-muted-foreground">
      {phase === 'player' && !hasOutcome ? (
        <>
          Find the best move for{' '}
          <span className="font-medium text-foreground">
            {solvingColor === 'w' ? 'White' : 'Black'}
          </span>
          .
        </>
      ) : (
        ' '
      )}
    </p>
  );
}

export function Overlay({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-2.5 rounded-[4px] p-6 text-center backdrop-blur-sm',
        tone === 'neutral' ? 'bg-background/55' : 'bg-background/75',
      )}
    >
      {children}
    </div>
  );
}
