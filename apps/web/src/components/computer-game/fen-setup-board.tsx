'use client';

import { useState } from 'react';
import { AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Chessboard } from '@/components/board/chessboard';
import { isValidFen } from '@/lib/openings';
import { createComputerGameFromFen } from '@/lib/api/computer-games';
import type { CreateComputerGameDto } from '@purechess/shared';
import { cn } from '@/lib/utils';

interface FenSetupBoardProps {
  level: CreateComputerGameDto['level'];
  color: CreateComputerGameDto['color'];
  timeControlSeconds: number;
  incrementSeconds: number;
  onGameCreated: (gameId: string) => void;
  onCancel: () => void;
}

export function FenSetupBoard({
  level,
  color,
  timeControlSeconds,
  incrementSeconds,
  onGameCreated,
  onCancel,
}: FenSetupBoardProps) {
  const [fen, setFen] = useState('');
  const [touched, setTouched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedFen = fen.trim();
  const valid = trimmedFen !== '' && isValidFen(trimmedFen);
  const showError = touched && trimmedFen !== '' && !valid;

  async function handleStart() {
    if (!valid) return;
    setIsPending(true);
    setSubmitError(null);
    try {
      const result = await createComputerGameFromFen({
        fen: trimmedFen,
        level,
        color,
        timeControlSeconds,
        incrementSeconds,
      });
      onGameCreated(result.gameId);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to start game. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="fen-input" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          FEN Position
        </Label>
        <textarea
          id="fen-input"
          rows={2}
          spellCheck={false}
          placeholder="Paste a FEN string… e.g. rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
          value={fen}
          onChange={(e) => {
            setFen(e.target.value);
            setTouched(false);
            setSubmitError(null);
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          aria-describedby={showError ? 'fen-error' : undefined}
          className={cn(
            'w-full resize-none rounded-md px-3 py-2 font-mono text-xs',
            'border bg-raised/40 text-foreground',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition-colors',
            showError ? 'border-destructive/60' : 'border-border/70',
          )}
        />
        {showError && (
          <p id="fen-error" role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Invalid FEN — check that all 6 fields are present and the position is legal.
          </p>
        )}
      </div>

      {valid && (
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-border/60',
            'bg-raised/20 p-2',
          )}
          aria-label="Board preview"
        >
          <Chessboard position={trimmedFen} readOnly orientation="white" />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleStart}
          disabled={!valid || isPending}
          className="h-11 flex-1 bg-foreground text-background hover:bg-foreground/90 shadow-elevated"
        >
          <Play className="mr-2 h-4 w-4" />
          {isPending ? 'Starting…' : 'Start from Position'}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          className="h-11 flex-1 text-muted-foreground hover:text-foreground"
        >
          Back
        </Button>
      </div>

      {submitError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {submitError}
        </p>
      )}
    </div>
  );
}
