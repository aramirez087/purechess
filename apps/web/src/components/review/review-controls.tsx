'use client';

import { useEffect } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewControlsProps {
  onStart: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
  /** Disables the start/previous buttons (ply 0). */
  atStart?: boolean;
  /** Disables the next/end buttons (final ply). */
  atEnd?: boolean;
  /**
   * Bind arrow/Home/End keys to seek. Default true. Set false where another
   * hook already owns keyboard navigation (the live game's useGameKeyboard),
   * so a single keypress doesn't seek twice.
   */
  bindKeys?: boolean;
}

// Same quiet recipe as the game clients' control buttons, squared for icons.
// Boundary states use aria-disabled (not disabled) so keyboard focus is
// retained when the focused button reaches the start/end of the game; the
// aria-disabled:* variants out-specify the hover/active affordances.
const seekButtonClass = cn(
  'chrome-btn inline-flex h-10 w-10 items-center justify-center rounded-[7px] active:translate-y-px',
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
  'aria-disabled:hover:border-border aria-disabled:hover:text-muted-foreground',
  'aria-disabled:active:translate-y-0 aria-disabled:active:bg-background/40',
);

export function ReviewControls({
  onStart,
  onPrev,
  onNext,
  onEnd,
  atStart = false,
  atEnd = false,
  bindKeys = true,
}: ReviewControlsProps) {
  useEffect(() => {
    if (!bindKeys) return;
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'Home':
          e.preventDefault();
          if (e.key === 'Home') onStart(); else onPrev();
          break;
        case 'ArrowRight':
        case 'End':
          e.preventDefault();
          if (e.key === 'End') onEnd(); else onNext();
          break;
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          onStart();
          break;
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          onEnd();
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart, onPrev, onNext, onEnd, bindKeys]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          if (!atStart) onStart();
        }}
        aria-disabled={atStart}
        aria-label="Go to start"
        title="Go to start (Home)"
        className={seekButtonClass}
      >
        <ChevronFirst className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!atStart) onPrev();
        }}
        aria-disabled={atStart}
        aria-label="Previous move"
        title="Previous move (Left arrow)"
        className={seekButtonClass}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!atEnd) onNext();
        }}
        aria-disabled={atEnd}
        aria-label="Next move"
        title="Next move (Right arrow)"
        className={seekButtonClass}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!atEnd) onEnd();
        }}
        aria-disabled={atEnd}
        aria-label="Go to end"
        title="Go to end (End)"
        className={seekButtonClass}
      >
        <ChevronLast className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}