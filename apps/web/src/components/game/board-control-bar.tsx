'use client';

import { FlipVertical2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BoardControlBarProps {
  onFlip: () => void;
  /** Page-specific controls (Resign / New game / replay seek group). */
  children?: React.ReactNode;
  className?: string;
}

export function BoardControlBar({ onFlip, children, className }: BoardControlBarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-[6px] border border-[#2b332c] bg-[#121511] p-2',
        className,
      )}
    >
      <button
        type="button"
        onClick={onFlip}
        aria-label="Flip board"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-[5px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-colors hover:border-[#3a443b] hover:text-[#f1eee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
      >
        <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
        Flip
      </button>
      {children}
    </div>
  );
}
