'use client';

import { FlipVertical2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BoardControlBarProps {
  onFlip: () => void;
  /** Page-specific controls (Resign / New game / replay seek group). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Chromeless control row — no card border/background of its own so it can
 * dock flush inside a rail footer. Buttons keep their own chrome.
 */
export function BoardControlBar({ onFlip, children, className }: BoardControlBarProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <button
        type="button"
        onClick={onFlip}
        aria-label="Flip board"
        className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
      >
        <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
        Flip
      </button>
      {children}
    </div>
  );
}
