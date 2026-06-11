'use client';

import { cn } from '@/lib/utils';

export interface MoveErrorNoticeProps {
  /** Server rejection message; renders nothing when null. */
  message: string | null;
  className?: string;
}

/**
 * Move-rejection notice for the game rails. Position it absolutely (e.g.
 * pinned over the bottom of the move sheet) so an error appearing mid-game
 * never reflows the rail. Solid backing keeps it legible over notation rows.
 * The notice is purely informational (no interactive children), so it is
 * pointer-events-none: clicks pass through to the move rows it may overlap.
 * Text is a lighter red than --destructive for AA contrast on the dark
 * tinted backing.
 */
export function MoveErrorNotice({ message, className }: MoveErrorNoticeProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        'animate-rise pointer-events-none rounded-[10px] border border-destructive/40 bg-[#1c100f] px-3 py-2 text-sm text-[hsl(0_72%_72%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      {message}
    </div>
  );
}
