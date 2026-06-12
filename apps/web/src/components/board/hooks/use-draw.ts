'use client';

import { useCallback, useRef, useState } from 'react';
import type { Square } from '@purechess/shared';
import type { AnnotationColor, BoardShape } from '@/lib/board/annotations';
import { colorFromModifiers } from '@/lib/board/annotations';

export interface DrawState {
  from: Square;
  /** Square under the pointer right now; null while off-board. */
  current: Square | null;
  color: AnnotationColor;
}

interface UseDrawOptions {
  /** Same coordinate math the drag system uses (pointToSquare on the board rect). */
  getSquareFromPoint: (x: number, y: number) => Square | null;
  onShapeComplete: (shape: BoardShape) => void;
}

/**
 * Right-click annotation drawing. Right-drag from square to square emits an
 * arrow; a right-click released on (or off-board from) the start square emits
 * a circle. The brush color is locked in by the modifier keys held at
 * pointerdown. Handlers attach to the board grid alongside the left-button
 * drag handlers — they ignore every pointer except the one that started a
 * right-button draw.
 *
 * Event logic reads a ref, not state: a pointerup landing in the same frame
 * as the pointerdown runs against a render where `drawing` is still null
 * (same race use-drag hit — React batches the state flush). State exists only
 * to drive the preview render.
 */
export function useDraw({ getSquareFromPoint, onShapeComplete }: UseDrawOptions) {
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const drawRef = useRef<(DrawState & { pointerId: number }) | null>(null);

  const onDrawPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 2 || drawRef.current) return;
      const from = getSquareFromPoint(e.clientX, e.clientY);
      if (!from) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture unsupported (rare); on-board draws still work
      }
      const next = { from, current: from, color: colorFromModifiers(e), pointerId: e.pointerId };
      drawRef.current = next;
      setDrawing({ from: next.from, current: next.current, color: next.color });
    },
    [getSquareFromPoint],
  );

  const onDrawPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const draw = drawRef.current;
      if (!draw || e.pointerId !== draw.pointerId) return;
      const sq = getSquareFromPoint(e.clientX, e.clientY);
      if (sq !== draw.current) {
        draw.current = sq;
        setDrawing({ from: draw.from, current: sq, color: draw.color });
      }
    },
    [getSquareFromPoint],
  );

  const onDrawPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const draw = drawRef.current;
      if (!draw || e.pointerId !== draw.pointerId) return;
      drawRef.current = null;
      setDrawing(null);
      const to = getSquareFromPoint(e.clientX, e.clientY) ?? draw.current;
      if (!to || to === draw.from) {
        onShapeComplete({ type: 'circle', square: draw.from, color: draw.color });
      } else {
        onShapeComplete({ type: 'arrow', from: draw.from, to, color: draw.color });
      }
    },
    [getSquareFromPoint, onShapeComplete],
  );

  const onDrawPointerCancel = useCallback((e: React.PointerEvent) => {
    const draw = drawRef.current;
    if (!draw || e.pointerId !== draw.pointerId) return;
    drawRef.current = null;
    setDrawing(null);
  }, []);

  // The board owns right-click: plain right-click draws a circle, so the
  // browser context menu never belongs here. (macOS fires contextmenu on
  // pointerdown, Windows on pointerup — suppressing the event covers both.)
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    drawing,
    onDrawPointerDown,
    onDrawPointerMove,
    onDrawPointerUp,
    onDrawPointerCancel,
    onContextMenu,
  };
}
