'use client';

import { Flame, Trophy } from 'lucide-react';
import type { TrainingDayDto, TrainingStreakDto } from '@purechess/shared';
import { cn } from '@/lib/utils';

/**
 * The streak header: the current streak (flame), the longest streak, and a
 * small GitHub-style contribution calendar of recent training days. All values
 * are server-computed (the client only renders them). No new visual language —
 * the activity cells reuse the brass accent at graded opacities.
 */

/** How many weeks the calendar shows (columns). */
const WEEKS = 12;
const DAYS_PER_WEEK = 7;

export interface StreakBannerProps {
  streak: TrainingStreakDto;
}

export function StreakBanner({ streak }: StreakBannerProps) {
  const cells = buildCalendar(streak.history ?? [], WEEKS * DAYS_PER_WEEK);

  return (
    <section
      data-testid="streak-banner"
      className="flex flex-col gap-5 rounded-[12px] border border-border/70 bg-surface/60 p-5 shadow-elevated sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-6">
        <Stat
          icon={<Flame className="h-5 w-5" aria-hidden="true" />}
          value={streak.currentStreak}
          unit={streak.currentStreak === 1 ? 'day' : 'days'}
          label="Current streak"
          accent
          testid="streak-current"
        />
        <Stat
          icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
          value={streak.longestStreak}
          unit={streak.longestStreak === 1 ? 'day' : 'days'}
          label="Longest"
          testid="streak-longest"
        />
      </div>

      <div
        data-testid="streak-calendar"
        className="grid grid-flow-col grid-rows-7 gap-1"
        role="img"
        aria-label={`Training activity over the last ${WEEKS} weeks`}
      >
        {cells.map((cell) => (
          <span
            key={cell.day}
            data-testid="streak-cell"
            data-active={cell.active}
            title={`${cell.day}: ${cell.count} ${cell.count === 1 ? 'item' : 'items'}`}
            className={cn(
              'h-3 w-3 rounded-[3px]',
              cell.active ? activeClass(cell.count) : 'bg-muted/50',
            )}
          />
        ))}
      </div>
    </section>
  );
}

function Stat({
  icon,
  value,
  unit,
  label,
  accent,
  testid,
}: {
  icon: React.ReactNode;
  value: number;
  unit: string;
  label: string;
  accent?: boolean;
  testid: string;
}) {
  return (
    <div className="flex items-center gap-3" data-testid={testid}>
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-[10px]',
          accent ? 'bg-brass/15 text-brass-text' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="font-display text-2xl leading-none text-foreground">
          {value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

interface Cell {
  day: string;
  count: number;
  active: boolean;
}

/**
 * Build a fixed grid of the last `total` days (oldest-first so the grid reads
 * left→right, top→bottom). Each cell carries the day's total activity count.
 * Pure + exported for testing.
 */
export function buildCalendar(history: TrainingDayDto[], total: number): Cell[] {
  const byDay = new Map(
    history.map((d) => [d.day, d.puzzlesSolved + d.reviewsDone + d.drillsDone]),
  );
  const cells: Cell[] = [];
  const today = new Date(`${todayKey()}T00:00:00.000Z`);
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = byDay.get(key) ?? 0;
    cells.push({ day: key, count, active: count > 0 });
  }
  return cells;
}

/** Activity intensity → brass opacity band (more activity = more saturated). */
function activeClass(count: number): string {
  if (count >= 10) return 'bg-brass';
  if (count >= 5) return 'bg-brass/70';
  if (count >= 2) return 'bg-brass/45';
  return 'bg-brass/25';
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
