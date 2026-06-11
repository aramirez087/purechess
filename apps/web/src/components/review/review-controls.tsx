'use client';

import { useEffect } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReviewControlsProps {
  onStart: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
  /** Disables the start/previous buttons (ply 0). */
  atStart?: boolean;
  /** Disables the next/end buttons (final ply). */
  atEnd?: boolean;
}

// Same quiet recipe as the game clients' control buttons, squared for icons.
// Boundary states use aria-disabled (not disabled) so keyboard focus is
// retained when the focused button reaches the start/end of the game; the
// aria-disabled:* variants out-specify the hover/active affordances.
const seekButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-[#2b332c] aria-disabled:hover:text-[#c7cfc4] aria-disabled:active:translate-y-0 aria-disabled:active:bg-[#0b0d0b]/40';

export function ReviewControls({
  onStart,
  onPrev,
  onNext,
  onEnd,
  atStart = false,
  atEnd = false,
}: ReviewControlsProps) {
  useEffect(() => {
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
  }, [onStart, onPrev, onNext, onEnd]);

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
