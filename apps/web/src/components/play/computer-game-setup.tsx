'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { createComputerGame } from '@/lib/api/computer-games';
import type { CreateComputerGameDto } from '@purchess/shared';

const TIME_CONTROLS = [
  { label: 'Bullet 1+0', seconds: 60, increment: 0 },
  { label: 'Blitz 3+2', seconds: 180, increment: 2 },
  { label: 'Rapid 10+0', seconds: 600, increment: 0 },
];

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
  const [tcIndex, setTcIndex] = useState(1);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsPending(true);
    setError(null);
    try {
      const tc = TIME_CONTROLS[tcIndex];
      const result = await createComputerGame({
        level,
        color,
        timeControlSeconds: tc.seconds,
        incrementSeconds: tc.increment,
      });
      onGameCreated(result.gameId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start game. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Play vs Computer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4, 5, 6, 7, 8] as CreateComputerGameDto['level'][]).map((l) => (
              <Button
                key={l}
                variant={level === l ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLevel(l)}
              >
                {l}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{LEVEL_LABELS[level]}</p>
        </div>

        <div className="space-y-2">
          <Label>Play as</Label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <Button
                key={c.value}
                variant={color === c.value ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setColor(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Time Control</Label>
          <div className="flex gap-2">
            {TIME_CONTROLS.map((tc, i) => (
              <Button
                key={tc.label}
                variant={tcIndex === i ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTcIndex(i)}
              >
                {tc.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleStart} disabled={isPending} className="flex-1">
            {isPending ? 'Starting…' : 'Start Game'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Back
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
