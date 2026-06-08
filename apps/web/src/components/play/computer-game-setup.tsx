'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Cpu, Play } from 'lucide-react';
import { createComputerGame } from '@/lib/api/computer-games';
import type { CreateComputerGameDto } from '@purechess/shared';
import { cn } from '@/lib/utils';

// Games vs the computer are untimed — the in-game UI shows the clock as
// "Unlimited" and the server never flags on time. These values are sent only to
// satisfy the create DTO / category column; they have no gameplay effect.
const UNTIMED_SECONDS = 600;
const UNTIMED_INCREMENT = 0;

const LEVEL_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Beginner+',
  3: 'Easy',
  4: 'Intermediate',
  5: 'Intermediate+',
  6: 'Advanced',
  7: 'Expert',
  8: 'Master',
};

const COLORS: { label: string; value: CreateComputerGameDto['color'] }[] = [
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
  { label: 'Random', value: 'random' },
];

interface ComputerGameSetupProps {
  onCancel: () => void;
  onGameCreated: (gameId: string) => void;
}

export function ComputerGameSetup({ onCancel, onGameCreated }: ComputerGameSetupProps) {
  const [level, setLevel] = useState<CreateComputerGameDto['level']>(4);
  const [color, setColor] = useState<CreateComputerGameDto['color']>('random');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsPending(true);
    setError(null);
    try {
      const result = await createComputerGame({
        level,
        color,
        timeControlSeconds: UNTIMED_SECONDS,
        incrementSeconds: UNTIMED_INCREMENT,
      });
      onGameCreated(result.gameId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start game. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
            <Cpu className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-lg tracking-tight">Play vs Computer</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Untimed · 8 difficulty levels</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-7 pt-6">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Difficulty
            </Label>
            <span className="text-sm font-medium text-brass">
              Level {level} · {LEVEL_LABELS[level]}
            </span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7, 8] as CreateComputerGameDto['level'][]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
                className={cn(
                  'h-10 rounded-md text-sm font-mono tabular-nums transition-all',
                  'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  level === l
                    ? 'border-brass/60 bg-brass/10 text-foreground shadow-inner-hairline'
                    : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Play as
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-pressed={color === c.value}
                className={cn(
                  'h-10 rounded-md text-sm font-medium transition-all',
                  'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  color === c.value
                    ? 'border-brass/60 bg-brass/10 text-foreground shadow-inner-hairline'
                    : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button
            onClick={handleStart}
            disabled={isPending}
            className="h-11 flex-1 bg-foreground text-background hover:bg-foreground/90 shadow-elevated"
          >
            <Play className="mr-2 h-4 w-4" />
            {isPending ? 'Starting…' : 'Start Game'}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="h-11 flex-1 text-muted-foreground hover:text-foreground"
          >
            Back
          </Button>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
