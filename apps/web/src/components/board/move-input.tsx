'use client';

import { useEffect, useRef } from 'react';
import type { PieceType, Color } from '@purechess/shared';
import { getPieceSvg } from '@/lib/board/piece-svgs';

const PROMOTION_PIECES: PieceType[] = ['q', 'r', 'b', 'n'];

const PIECE_NAMES: Record<string, string> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};

interface MoveInputProps {
  color: Color;
  onSelect: (piece: PieceType) => void;
  onCancel: () => void;
}

export function MoveInput({ color, onSelect, onCancel }: MoveInputProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Latest onCancel for the document-level Escape listener, so the listener
  // never goes stale and never needs re-subscribing.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  // Element focused before the dialog opened — captured on first render,
  // before React applies autoFocus to the queen button during commit.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  if (typeof document !== 'undefined' && restoreFocusRef.current === null) {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  useEffect(() => {
    // Escape must close the dialog even when focus has wandered off the
    // overlay, so listen at the document level (capture phase) instead of
    // relying on the event bubbling through the overlay.
    const onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', onDocumentKeyDown, true);

    // Resolve the fallback focus target (the board grid) while still mounted.
    const grid =
      dialogRef.current?.parentElement?.querySelector<HTMLElement>('[role="grid"]') ??
      document.querySelector<HTMLElement>('[role="grid"]');

    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown, true);
      // Every close path (select or cancel) unmounts this component, so
      // restoring focus here covers all of them and never strands focus on
      // <body> after the dialog's buttons are removed.
      const previous = restoreFocusRef.current;
      if (previous && previous !== document.body && previous.isConnected) {
        previous.focus();
      } else {
        grid?.focus();
      }
    };
  }, []);

  // aria-modal promises a focus trap: loop Tab/Shift+Tab across the four
  // piece buttons, and pull focus back in if it somehow escaped the dialog.
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !dialog.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialogRef}
      className="result-scrim absolute inset-0 z-50 flex items-center justify-center backdrop-blur-[3px]"
      onClick={onCancel}
      onKeyDown={handleDialogKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
      tabIndex={-1}
    >
      <div
        className="result-card flex flex-col items-center gap-2.5 rounded-[14px] border border-border/90 px-4 pb-4 pt-3 shadow-[0_24px_70px_-18px_hsl(var(--shadow-rgb)/0.8),0_0_60px_-24px_hsl(var(--brass)/0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Promote to
        </p>
        <div className="flex gap-1.5">
          {PROMOTION_PIECES.map((type) => {
            const SvgComponent = getPieceSvg(type, color);
            return (
              <button
                key={type}
                autoFocus={type === 'q'}
                className="h-16 w-16 rounded-[10px] border border-transparent bg-background/45 p-1.5 transition-all hover:-translate-y-0.5 hover:border-brass/55 hover:bg-brass/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                onClick={() => onSelect(type)}
                aria-label={`Promote to ${PIECE_NAMES[type]}`}
              >
                <SvgComponent className="h-full w-full drop-shadow-[0_3px_4px_hsl(var(--shadow-rgb)/0.4)]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}