'use client';

import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';

export interface GameTopBarProps {
  /** Optional rating chip (e.g. the player's rating). */
  rating?: number | null;
  /** Optional label prefixing the rating, e.g. "Blitz". */
  ratingLabel?: string;
  /** Absolutely centered context line (e.g. a review header). Hidden below md. */
  center?: React.ReactNode;
  /** Override the entire right-hand cluster. */
  right?: React.ReactNode;
}

export function GameTopBar({ rating, ratingLabel, center, right }: GameTopBarProps) {
  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-[#2b332c] bg-[#0b0d0b]/95 px-4 backdrop-blur">
      <Link href="/" className="text-[#f1eee6] transition-opacity hover:opacity-80">
        <Logo />
      </Link>
      {center && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          {center}
        </div>
      )}
      <div className="flex items-center gap-2 text-[#c7cfc4]">
        {right ?? (
          <>
            {typeof rating === 'number' && (
              <span className="rounded-full border border-[#2b332c] bg-[#121511] px-2.5 py-1 text-xs font-medium tabular-nums text-[#d8d2c3]">
                {ratingLabel ? `${ratingLabel} ` : ''}
                {rating}
              </span>
            )}
            <SettingsDialog />
          </>
        )}
      </div>
    </header>
  );
}
