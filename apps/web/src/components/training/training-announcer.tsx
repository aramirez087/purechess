'use client';

/**
 * One polite live region per training surface for SOLVE OUTCOMES and session
 * progress — the screen-reader counterpart to the visual result overlays
 * (which are aria-hidden icons + non-live text). It deliberately does NOT
 * re-narrate the move: the Chessboard already owns a `role="status"` region
 * that announces every position change (move SAN, check, mate). This region
 * carries only the verdict + progress so the two never double-announce.
 *
 * Reuses the {@link LiveAnnouncer} pattern (computer-game): an sr-only
 * `role="status" aria-live="polite" aria-atomic` node whose text content is
 * the only thing read aloud. Drive it with a fresh `message` on each settled
 * outcome; pass `''` (or nothing) the rest of the time so it stays quiet.
 */

export interface TrainingAnnouncerProps {
  /** The full sentence to announce, e.g. "Correct. Solved 3 of 10." Empty = silent. */
  message: string;
}

export function TrainingAnnouncer({ message }: TrainingAnnouncerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="training-announcer"
    >
      {message}
    </div>
  );
}
