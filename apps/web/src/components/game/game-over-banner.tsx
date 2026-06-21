'use client';

import { cn } from '@/lib/utils';
import type { ResultTone } from '@/components/game/result-overlay';

interface GameOverBannerProps {
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
}

const TONE_CLASSES: Record<ResultTone, string> = {
  win: 'bg-gradient-to-b from-brass/[0.14] to-transparent',
  draw: 'bg-gradient-to-b from-raised to-transparent',
  loss: 'bg-gradient-to-b from-destructive/[0.12] to-transparent',
};

export function GameOverBanner({ tone, resultLabel, reasonLabel }: GameOverBannerProps) {
  return (
    <div className={cn('px-4 py-3.5 text-center', TONE_CLASSES[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Game over
      </p>
      <p className="font-display mt-1 text-[22px] italic leading-tight text-[hsl(var(--move-active-text))]">
        {resultLabel}
      </p>
      {reasonLabel && (
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--result-reason))]">
          by {reasonLabel}
        </p>
      )}
    </div>
  );
}