'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, Cpu, Play } from 'lucide-react';
import { createComputerGame } from '@/lib/api/computer-games';
import type { CreateComputerGameDto } from '@purechess/shared';
import { TIME_CONTROL_PRESETS } from '@purechess/shared';
import { cn } from '@/lib/utils';

// Dummy sentinel for untimed games — keeps the DTO valid; has no gameplay effect.
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

const TIME_PICKER_PRESETS: { key: string; sublabel: string; label: string }[] = [
  { key: 'untimed', sublabel: '∞', label: 'Untimed' },
  { key: '1+0', sublabel: '1|0', label: 'Bullet' },
  { key: '3+2', sublabel: '3|2', label: 'Blitz' },
  { key: '5+0', sublabel: '5|0', label: 'Blitz' },
  { key: '10+0', sublabel: '10|0', label: 'Rapid' },
];

const THINK_TIME_MAP: Record<string, number> = {
  fast: 300,
  normal: 1000,
  slow: 2500,
};

const COLORS: { label: string; value: CreateComputerGameDto['color'] }[] = [
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
  { label: 'Random', value: 'random' },
];

// Shared pill class fragments.
const PILL_BASE =
  'rounded-md text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PILL_ACTIVE =
  'bg-brass text-background font-semibold border-brass ring-2 ring-brass ring-offset-1 ring-offset-background';
const PILL_INACTIVE =
  'bg-raised/40 border-border/60 text-muted-foreground hover:bg-raised hover:text-foreground';

interface ComputerGameSetupProps {
  onCancel: () => void;
  onGameCreated: (gameId: string) => void;
}

export function ComputerGameSetup({ onCancel, onGameCreated }: ComputerGameSetupProps) {
  const [level, setLevel] = useState<CreateComputerGameDto['level']>(4);
  const [color, setColor] = useState<CreateComputerGameDto['color']>('random');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timePreset, setTimePreset] = useState<string>('untimed');
  const [strengthMode, setStrengthMode] = useState<'level' | 'elo'>('level');
  const [eloTarget, setEloTarget] = useState<number>(1500);
  const [humanLike, setHumanLike] = useState(false);
  const [thinkTime, setThinkTime] = useState<'auto' | 'fast' | 'normal' | 'slow'>('auto');

  const resolvedTimeControl =
    timePreset === 'untimed' || !(timePreset in TIME_CONTROL_PRESETS)
      ? { initialSeconds: UNTIMED_SECONDS, incrementSeconds: UNTIMED_INCREMENT }
      : TIME_CONTROL_PRESETS[timePreset];

  const timeLabel =
    timePreset === 'untimed'
      ? 'Untimed'
      : (TIME_CONTROL_PRESETS[timePreset]?.label ?? timePreset);
  const strengthLabel =
    strengthMode === 'elo'
      ? 'ELO ' + eloTarget
      : 'Level ' + level + ' · ' + LEVEL_LABELS[level];
  const headerCopy = timeLabel + ' · ' + strengthLabel;

  async function handleStart() {
    setIsPending(true);
    setError(null);
    try {
      const payload: CreateComputerGameDto = {
        level: strengthMode === 'elo' ? 4 : level,
        color,
        timeControlSeconds: resolvedTimeControl.initialSeconds,
        incrementSeconds: resolvedTimeControl.incrementSeconds,
        ...(strengthMode === 'elo' && { eloTarget }),
        ...(humanLike && { styleBlunderCp: 50 }),
        ...(thinkTime !== 'auto' && { thinkTimeMs: THINK_TIME_MAP[thinkTime] }),
      };
      const result = await createComputerGame(payload);
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
            <p className="mt-0.5 text-xs text-muted-foreground">{headerCopy}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Time control */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Time Control
          </Label>
          <div className="grid grid-cols-5 gap-1.5">
            {TIME_PICKER_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setTimePreset(p.key)}
                aria-pressed={timePreset === p.key}
                aria-label={p.label + ' ' + p.sublabel}
                className={cn(
                  PILL_BASE,
                  'flex h-auto flex-col items-center justify-center gap-0.5 py-2',
                  timePreset === p.key ? PILL_ACTIVE : PILL_INACTIVE,
                )}
              >
                <span className="font-mono text-[11px] leading-none">{p.sublabel}</span>
                <span className="text-[10px] leading-none opacity-70">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Strength */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Strength
            </Label>
            {strengthMode === 'level' && (
              <span className="text-sm font-medium text-brass">
                Level {level} &middot; {LEVEL_LABELS[level]}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(['level', 'elo'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStrengthMode(mode)}
                aria-pressed={strengthMode === mode}
                className={cn(
                  PILL_BASE,
                  'h-9',
                  strengthMode === mode ? PILL_ACTIVE : PILL_INACTIVE,
                )}
              >
                {mode === 'level' ? 'By Level' : 'ELO Target'}
              </button>
            ))}
          </div>

          {strengthMode === 'level' && (
            <div className="grid grid-cols-8 gap-1.5">
              {([1, 2, 3, 4, 5, 6, 7, 8] as CreateComputerGameDto['level'][]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                  aria-label={'Level ' + l + ' ' + LEVEL_LABELS[l]}
                  className={cn(
                    'relative h-11 rounded-md text-sm font-mono tabular-nums transition-all',
                    'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    level === l
                      ? 'bg-brass text-background font-semibold border-brass ring-2 ring-brass ring-offset-1 ring-offset-background'
                      : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                  )}
                >
                  {level === l && (
                    <span className="absolute right-0.5 top-0.5">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                  {l}
                </button>
              ))}
            </div>
          )}

          {strengthMode === 'elo' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={600}
                  max={2800}
                  step={50}
                  value={eloTarget}
                  onChange={(e) => setEloTarget(Number(e.target.value))}
                  aria-label="ELO target"
                  className="h-2 flex-1 cursor-pointer [accent-color:hsl(var(--brass))]"
                />
                <input
                  type="number"
                  min={600}
                  max={2800}
                  step={50}
                  value={eloTarget}
                  onChange={(e) => {
                    const v = Math.max(600, Math.min(2800, Number(e.target.value)));
                    setEloTarget(v);
                  }}
                  aria-label="ELO target value"
                  className="w-20 rounded-md border border-border/70 bg-raised/40 px-2 py-1 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Engine plays at approximately ELO {eloTarget}
              </p>
            </div>
          )}
        </div>

        {/* Play as */}
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
                    ? 'bg-brass text-background font-semibold border-brass ring-2 ring-brass ring-offset-1 ring-offset-background'
                    : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Think time */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Think Time
          </Label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['auto', 'fast', 'normal', 'slow'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setThinkTime(t)}
                aria-pressed={thinkTime === t}
                className={cn(
                  PILL_BASE,
                  'h-9',
                  thinkTime === t ? PILL_ACTIVE : PILL_INACTIVE,
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Human-like play */}
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-raised/20 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">Human-like play</p>
            <p className="text-xs text-muted-foreground">Adds occasional inaccuracies</p>
          </div>
          <Switch
            checked={humanLike}
            onCheckedChange={setHumanLike}
            aria-label="Human-like play"
            className="data-[state=checked]:bg-brass"
          />
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
