'use client';

import { Label } from '@/components/ui/label';
import { PILL_ACTIVE, PILL_BASE, PILL_INACTIVE } from '@/components/play/pill-styles';
import { cn } from '@/lib/utils';

// ─── Time Control Picker ──────────────────────────────────────────────────────

export interface TimeControlOption {
  label: string;
  sub: string;
}

export interface TimeControlPickerProps {
  options: readonly TimeControlOption[];
  value: number;
  onChange: (index: number) => void;
}

export function TimeControlPicker({ options, value, onChange }: TimeControlPickerProps) {
  return (
    <div className="space-y-3">
      <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Time control
      </Label>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-7">
        {options.map((tc, i) => (
          <button
            key={tc.label}
            type="button"
            onClick={() => onChange(i)}
            aria-pressed={value === i}
            aria-label={tc.sub + ' ' + tc.label}
            className={cn(
              PILL_BASE,
              'flex h-auto flex-col items-center justify-center gap-0.5 py-2',
              value === i ? PILL_ACTIVE : PILL_INACTIVE,
            )}
          >
            <span className="font-mono text-[11px] leading-none tabular-nums">{tc.label}</span>
            <span className="text-[11px] leading-none">{tc.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Stakes Picker ────────────────────────────────────────────────────────────

export interface StakesPickerProps {
  rated: boolean;
  onChange: (rated: boolean) => void;
}

const STAKES_OPTIONS = [
  { label: 'Rated', value: true, sub: 'Counts toward your rating' },
  { label: 'Casual', value: false, sub: 'Just for the game' },
] as const;

export function StakesPicker({ rated, onChange }: StakesPickerProps) {
  return (
    <div className="space-y-3">
      <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Stakes
      </Label>
      <div className="grid grid-cols-2 gap-1.5">
        {STAKES_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={rated === opt.value}
            className={cn(
              PILL_BASE,
              'flex h-auto flex-col items-center justify-center gap-0.5 py-2',
              rated === opt.value ? PILL_ACTIVE : PILL_INACTIVE,
            )}
          >
            <span className="text-sm leading-none">{opt.label}</span>
            <span className="text-[11px] leading-none">{opt.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

export type PieceColor = 'white' | 'black' | 'random';

export interface ColorPickerProps {
  value: PieceColor;
  onChange: (color: PieceColor) => void;
}

const COLOR_OPTIONS: { label: string; value: PieceColor }[] = [
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
  { label: 'Random', value: 'random' },
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          aria-pressed={value === c.value}
          className={cn(
            PILL_BASE,
            'h-10 text-sm',
            value === c.value ? PILL_ACTIVE : PILL_INACTIVE,
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ─── Level Labels ─────────────────────────────────────────────────────────────

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Beginner+',
  3: 'Easy',
  4: 'Intermediate',
  5: 'Intermediate+',
  6: 'Advanced',
  7: 'Expert',
  8: 'Master',
};

// ─── Strength Mode Picker ─────────────────────────────────────────────────────

export type StrengthMode = 'level' | 'elo';

export interface StrengthModePickerProps {
  mode: StrengthMode;
  onChange: (mode: StrengthMode) => void;
}

export function StrengthModePicker({ mode, onChange }: StrengthModePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(['level', 'elo'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={cn(PILL_BASE, 'h-9', mode === m ? PILL_ACTIVE : PILL_INACTIVE)}
        >
          {m === 'level' ? 'By Level' : 'ELO Target'}
        </button>
      ))}
    </div>
  );
}
