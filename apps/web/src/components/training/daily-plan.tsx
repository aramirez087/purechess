'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Castle,
  Check,
  Crosshair,
  RefreshCw,
  Sparkles,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { TrainingPlanDto, TrainingPlanItemDto } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Today's training plan: an ordered checklist of brass-CTA rows, a goal ring
 * that fills as the day's puzzle goal is met, and a quiet "Done for today"
 * celebration once everything is complete. The plan and all progress are
 * server-computed — this is a presentational client component.
 */

/** Icon per plan-item kind (no new visual language; lucide set, brass accent). */
const KIND_ICON: Record<TrainingPlanItemDto['kind'], LucideIcon> = {
  daily: Sun,
  theme: Crosshair,
  review: RefreshCw,
  rush: Sparkles,
  mistake: Crosshair,
  opening: Castle,
  endgame: Target,
};

const KIND_VERB: Record<TrainingPlanItemDto['kind'], string> = {
  daily: 'Solve',
  theme: 'Train',
  review: 'Review',
  rush: 'Start',
  mistake: 'Fix',
  opening: 'Drill',
  endgame: 'Practice',
};

export interface DailyPlanProps {
  plan: TrainingPlanDto;
}

export function DailyPlan({ plan }: DailyPlanProps) {
  const items = plan.items;
  const allDone = items.length > 0 && items.every((i) => i.completed);
  const goal = plan.dailyGoalPuzzles ?? 10;
  const solved = plan.puzzlesSolvedToday ?? 0;
  const goalMet = solved >= goal;

  return (
    <section data-testid="daily-plan" className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Today
          </span>
          <h2 className="font-display text-2xl italic tracking-[-0.01em] text-foreground">
            Your 10-minute plan
          </h2>
          {plan.estimatedMinutes ? (
            <p className="text-sm text-muted-foreground">
              About {plan.estimatedMinutes} min, aimed at what is costing you the most.
            </p>
          ) : null}
        </div>
        <GoalRing solved={Math.min(solved, goal)} goal={goal} met={goalMet} />
      </header>

      {items.length === 0 ? (
        <p
          data-testid="plan-empty"
          className="rounded-[10px] border border-border/70 bg-surface/60 p-5 text-sm text-muted-foreground"
        >
          Nothing queued right now — solve a few puzzles to build up signal and your plan will fill
          in.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5" data-testid="plan-items">
          {items.map((item, i) => (
            <PlanRow key={`${item.kind}:${item.targetSlug ?? i}`} item={item} />
          ))}
        </ol>
      )}

      {allDone ? (
        <p
          data-testid="plan-done"
          className="flex items-center justify-center gap-2 rounded-[10px] border border-brass/40 bg-brass-soft/20 px-4 py-3 text-sm font-medium text-brass-text"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Done for today
        </p>
      ) : null}
    </section>
  );
}

function PlanRow({ item }: { item: TrainingPlanItemDto }) {
  const Icon = KIND_ICON[item.kind] ?? Target;
  const verb = KIND_VERB[item.kind] ?? 'Start';
  const href = item.href ?? '/train';
  const target = item.target ?? item.count ?? 1;
  const done = item.doneToday ?? 0;
  const completed = Boolean(item.completed);

  return (
    <li
      data-testid="plan-row"
      data-kind={item.kind}
      data-completed={completed}
      className={cn(
        'flex items-center gap-4 rounded-[10px] border p-4 transition-colors',
        completed ? 'border-border/50 bg-muted/30' : 'border-border/70 bg-surface/60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]',
          completed ? 'bg-success/15 text-success' : 'bg-brass/15 text-brass-text',
        )}
      >
        {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'truncate font-medium',
            completed ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {item.label}
        </span>
        {target > 1 ? (
          <span data-testid="plan-progress" className="font-mono text-xs text-muted-foreground">
            {done} / {target}
          </span>
        ) : null}
      </div>

      <Button
        asChild
        className={cn(
          'h-9 shrink-0 gap-1.5 px-3.5 text-sm font-semibold',
          completed
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'bg-brass text-brass-foreground hover:bg-brass/90',
        )}
      >
        <Link href={href}>
          {completed ? 'Again' : verb}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

/** A small SVG progress ring filling as the day's puzzle goal is met. */
function GoalRing({ solved, goal, met }: { solved: number; goal: number; met: boolean }) {
  const pct = goal > 0 ? Math.min(1, solved / goal) : 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <div
      data-testid="goal-ring"
      data-met={met}
      className="relative flex h-14 w-14 shrink-0 items-center justify-center"
      role="img"
      aria-label={`${solved} of ${goal} daily puzzles`}
    >
      <svg viewBox="0 0 48 48" className="h-14 w-14 -rotate-90">
        <circle cx="24" cy="24" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          className={cn('fill-none transition-[stroke-dasharray]', met ? 'stroke-success' : 'stroke-brass')}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-medium text-foreground">
        {met ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : `${solved}/${goal}`}
      </span>
    </div>
  );
}
