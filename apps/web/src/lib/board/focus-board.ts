/**
 * Keyboard-focus restoration for auto-advancing drills.
 *
 * When a puzzle auto-advances the board re-renders with a new position. A
 * keyboard-only solver who had focus on the board grid must NOT be dropped to
 * `<body>` (the classic auto-advance a11y break): they need focus back on the
 * grid so arrow keys keep working on the next puzzle.
 *
 * We only restore focus when it was ALREADY inside the board container — so a
 * mouse user reading elsewhere on the page is never yanked back to the board by
 * a background auto-advance. The board's focusable element is the
 * `role="grid"` div inside the `[data-testid="chess-board"]` container.
 *
 * Pass the container element (or a ref to it). No-op on the server / when the
 * grid can't be found.
 */
export function focusBoard(container: HTMLElement | null | undefined): void {
  if (!container || typeof document === 'undefined') return;
  const grid = container.querySelector<HTMLElement>('[role="grid"]');
  if (!grid) return;
  // Only pull focus back if it was inside the board (keyboard solver) — never
  // steal it from a control the user tabbed to elsewhere.
  const active = document.activeElement;
  const focusWasInBoard = active instanceof Node && container.contains(active);
  if (!focusWasInBoard) return;
  grid.focus();
}
