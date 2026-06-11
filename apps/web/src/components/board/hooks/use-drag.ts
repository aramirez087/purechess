'use client';

import { useCallback, useRef, useState } from 'react';
import type { Square } from '@purechess/shared';
import type { DragState } from '@/lib/board/types';

const DRAG_THRESHOLD = 4;

interface UseDragOptions {
  onDragStart?: (square: Square) => void;
  onDragEnd?: (from: Square, to: Square | null) => void;
  getSquareFromPoint?: (x: number, y: number) => Square | null;
}

export function useDrag({ onDragStart, onDragEnd, getSquareFromPoint }: UseDragOptions) {
  const [dragState, setDragState] = useState<DragState>({
    active: false,
    from: null,
    piece: null,
    x: 0,
    y: 0,
    pointerId: null,
  });
  // Drives the touch-vs-mouse ghost offset; kept outside DragState (shared type).
  const [pointerType, setPointerType] = useState<string>('mouse');

  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const fromSquare = useRef<Square | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, square: Square) => {
      startPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = false;
      fromSquare.current = square;
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPos.current || !fromSquare.current) return;

      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        isDragging.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // setPointerCapture unsupported (rare); drag still works without it
        }
        onDragStart?.(fromSquare.current);
        setPointerType(e.pointerType || 'mouse');
        setDragState({
          active: true,
          from: fromSquare.current,
          piece: null,
          x: e.clientX,
          y: e.clientY,
          pointerId: e.pointerId,
        });
      }

      if (isDragging.current) {
        setDragState((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
      }
    },
    [onDragStart],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!fromSquare.current) return;

      if (isDragging.current) {
        const to = getSquareFromPoint?.(e.clientX, e.clientY) ?? null;
        onDragEnd?.(fromSquare.current, to);
      }

      isDragging.current = false;
      startPos.current = null;
      fromSquare.current = null;
      setDragState({ active: false, from: null, piece: null, x: 0, y: 0, pointerId: null });
    },
    [onDragEnd, getSquareFromPoint],
  );

  const onPointerCancel = useCallback(() => {
    if (isDragging.current && fromSquare.current) {
      onDragEnd?.(fromSquare.current, null);
    }
    isDragging.current = false;
    startPos.current = null;
    fromSquare.current = null;
    setDragState({ active: false, from: null, piece: null, x: 0, y: 0, pointerId: null });
  }, [onDragEnd]);

  return {
    dragState,
    pointerType,
    isDragging: isDragging.current,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
