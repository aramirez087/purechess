'use client';

import { useEffect, useRef, useState } from 'react';
import type { Piece, Square } from '@purechess/shared';
import { animationsDisabled, MOVE_DURATION_MS } from '@/lib/board/animations';
import { getPieceAt } from '@/lib/board/fen';
import { loadRules, peekRules } from '@/lib/board/rules-lazy';

export interface AnimatedPieceSpec {
  piece: Piece;
  from: Square;
  to: Square;
}

export interface MoveAnimation {
  pieces: AnimatedPieceSpec[];
  /** Victim of a capture: held at its square by the AnimationLayer while the mover slides in. */
  captured?: { piece: Piece; at: Square };
  /** Monotonic id so consecutive moves restart the slide. */
  key: number;
}

export interface DragMoveRef {
  from: Square;
  to: Square;
}

/**
 * Diffs consecutive `position` FENs and yields a short-lived slide animation
 * for the moved piece (plus the rook when castling).
 *
 * `lastDragMoveRef` holds the from/to of the most recent drag-drop; when the
 * position change matches it the slide is skipped (a dragged piece was already
 * released on its destination square — sliding it again would read as a double
 * move). The ref is cleared on every position change so a stale entry from a
 * rejected drop cannot suppress a later animation.
 */
export function useMoveAnimation(
  position: string,
  lastDragMoveRef: React.MutableRefObject<DragMoveRef | null>,
  enabled = true,
): MoveAnimation | null {
  const prevRef = useRef(position);
  const keyRef = useRef(0);
  const [anim, setAnim] = useState<MoveAnimation | null>(null);

  // Warm the rules module so the synchronous diff below can use it from the
  // first opponent move on. A position change that lands before the (lazy)
  // chess.js chunk resolves simply doesn't animate — same fallback as the
  // reduced-motion path.
  useEffect(() => {
    void loadRules();
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === position) return;
    prevRef.current = position;

    const dragMove = lastDragMoveRef.current;
    lastDragMoveRef.current = null;

    if (!enabled || animationsDisabled()) return;

    const rules = peekRules();
    if (!rules) return;

    const squares = rules.getAnimationSquares(prev, position);
    if (!squares) {
      setAnim(null);
      return;
    }
    if (dragMove && dragMove.from === squares.from && dragMove.to === squares.to) {
      setAnim(null);
      return;
    }

    const pieces: AnimatedPieceSpec[] = [];
    const moved = getPieceAt(position, squares.to);
    if (moved) pieces.push({ piece: moved, from: squares.from, to: squares.to });
    if (squares.rookFrom && squares.rookTo) {
      const rook = getPieceAt(position, squares.rookTo);
      if (rook) pieces.push({ piece: rook, from: squares.rookFrom, to: squares.rookTo });
    }
    if (pieces.length === 0) return;

    // The victim only exists in the pre-move position.
    let captured: MoveAnimation['captured'];
    if (squares.capturedAt) {
      const victim = getPieceAt(prev, squares.capturedAt);
      if (victim) captured = { piece: victim, at: squares.capturedAt };
    }

    keyRef.current += 1;
    setAnim({ pieces, captured, key: keyRef.current });
    // +120ms covers the layer's 2-rAF transition start plus the 60ms settle.
    const timer = setTimeout(() => setAnim(null), MOVE_DURATION_MS + 120);
    return () => clearTimeout(timer);
  }, [position, lastDragMoveRef, enabled]);

  return anim;
}
