'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Square as SquareType, Piece, MoveIntent, PieceType, Color } from '@purechess/shared';
import type { ChessboardProps, Premove, PromotionState } from '@/lib/board/types';
import { getPieceAt, fenToColorToMove, isPromotion } from '@/lib/board/fen';
import {
  getSquareAt,
  pointToSquare,
  snapToNearestDest,
  DROP_MARGIN_SQUARES,
  TOUCH_SNAP_RADIUS_SQUARES,
} from '@/lib/board/coords';
import { loadRules, peekRules, type RulesModule } from '@/lib/board/rules-lazy';
import { getPremoveDestinations } from '@/lib/board/premove-geometry';
import { toggleShape, type BoardShape } from '@/lib/board/annotations';
import { animationsDisabled } from '@/lib/board/animations';
import { soundEngine } from '@/lib/board/sound';
import { cn } from '@/lib/utils';
import { useBoardSettings } from './board-context';
import { useBoardResize } from './hooks/use-board-resize';
import { useDrag } from './hooks/use-drag';
import { useDraw } from './hooks/use-draw';
import { useClickMove } from './hooks/use-click-move';
import { useKeyboard } from './hooks/use-keyboard';
import { useMoveInput } from './hooks/use-move-input';
import { useMoveAnimation, type DragMoveRef } from './hooks/use-move-animation';
import { getPieceSvg } from '@/lib/board/piece-svgs';
import { AnimationLayer } from './animation-layer';
import { AnnotationLayer } from './annotation-layer';
import { Square } from './square';
import { Coordinates } from './coordinates';
import { MoveInput } from './move-input';
import { MoveInputOverlay } from './move-input-overlay';

function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 === 0;
}

function buildAriaLabel(square: SquareType, piece: Piece | null, legalDests: SquareType[]): string {
  const parts: string[] = [square];
  if (piece) {
    const colorName = piece.color === 'w' ? 'white' : 'black';
    const typeName =
      { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[piece.type] ??
      piece.type;
    parts.push(`${colorName} ${typeName}`);
  }
  if (legalDests.length > 0) {
    parts.push(`legal to ${legalDests.join(', ')}`);
  }
  return parts.join(', ');
}

export function Chessboard({
  position,
  orientation = 'white',
  legalMoves,
  onMove,
  lastMove,
  checkSquare: checkSquareProp,
  className,
  readOnly = false,
  freePlay = false,
  autoShapes,
  onShapesChange,
  externalShapes,
}: ChessboardProps) {
  const { settings } = useBoardSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  useBoardResize(containerRef);

  const [premove, setPremove] = useState<Premove | null>(null);
  const [promotion, setPromotion] = useState<PromotionState>({
    active: false,
    from: null,
    to: null,
  });
  const [showKeyboardFocus, setShowKeyboardFocus] = useState(false);
  const lastDragMoveRef = useRef<DragMoveRef | null>(null);

  // User-drawn annotations (right-click arrows/circles). The ref mirrors the
  // state so pointer handlers read the latest list without re-binding; every
  // mutation goes through these two helpers so onShapesChange always fires.
  const [shapes, setShapes] = useState<BoardShape[]>([]);
  const shapesRef = useRef<BoardShape[]>(shapes);

  const handleShapeComplete = useCallback(
    (shape: BoardShape) => {
      const next = toggleShape(shapesRef.current, shape);
      shapesRef.current = next;
      setShapes(next);
      onShapesChange?.(next);
    },
    [onShapesChange],
  );

  const clearShapes = useCallback(() => {
    if (shapesRef.current.length === 0) return;
    shapesRef.current = [];
    setShapes([]);
    onShapesChange?.([]);
  }, [onShapesChange]);

  // Parent-driven restoration: navigating to a tree node swaps in that node's
  // saved shapes. Not a user edit, so onShapesChange is NOT fired here.
  useEffect(() => {
    const next = externalShapes ?? [];
    shapesRef.current = next;
    setShapes(next);
  }, [externalShapes]);

  const anim = useMoveAnimation(position, lastDragMoveRef, settings.animationMs > 0);

  // chess.js (the rules module) loads lazily so it stays out of the eager
  // route chunk. Until it resolves (~one microtask once cached, one chunk
  // fetch cold) legal-move hints and check highlights are empty — input
  // still works, and the server validates every move anyway.
  const [rules, setRules] = useState<RulesModule | null>(peekRules);
  useEffect(() => {
    if (rules) return;
    let disposed = false;
    void loadRules().then((m) => {
      if (!disposed) setRules(m);
    });
    return () => {
      disposed = true;
    };
  }, [rules]);

  const colorToMove = useMemo(() => fenToColorToMove(position), [position]);
  // freePlay (analysis): the side to move is always "the player", so both
  // colors take input and the premove path never engages.
  const playerColor: Color = freePlay ? colorToMove : orientation === 'white' ? 'w' : 'b';
  const isPlayerTurn = colorToMove === playerColor;

  const checkSquare = useMemo(
    () => checkSquareProp ?? rules?.getCheckSquare(position),
    [checkSquareProp, rules, position],
  );

  const [srAnnouncement, setSrAnnouncement] = useState('');
  const prevSrRef = useRef(position);

  useEffect(() => {
    const prev = prevSrRef.current;
    if (prev === position) return;
    prevSrRef.current = position;
    let disposed = false;
    void loadRules().then((r) => {
      if (disposed) return;
      const msg = r.buildMoveAnnouncement(prev, position);
      if (msg) setSrAnnouncement(msg);
    });
    return () => {
      disposed = true;
    };
  }, [position]);

  // One sound per confirmed position change, typed by what happened — covers
  // both players' moves (the optimistic per-handler plays were move-only and
  // silent for the opponent).
  const prevSoundPosRef = useRef(position);
  useEffect(() => {
    const prev = prevSoundPosRef.current;
    if (prev === position) return;
    prevSoundPosRef.current = position;
    if (!settings.sound) return;

    let disposed = false;
    void loadRules().then((r) => {
      if (disposed) return;
      const sound = r.classifyMoveSound(prev, position);
      if (sound) soundEngine.play(sound);
    });
    return () => {
      disposed = true;
    };
  }, [position, settings.sound]);

  useEffect(() => {
    if (!premove) return;
    if (!isPlayerTurn) return;

    let disposed = false;
    void loadRules().then((r) => {
      if (disposed) return;
      const result = r.validatePremove(position, premove);
      setPremove(null);
      if (result && onMove) {
        onMove({ from: result.from, to: result.to, promotion: result.promotion });
      }
    });
    return () => {
      disposed = true;
    };
  }, [position, isPlayerTurn, premove, onMove]);

  const getPieceAtMemo = useCallback((sq: SquareType) => getPieceAt(position, sq), [position]);

  const isOwnPiece = useCallback(
    (sq: SquareType) => {
      const p = getPieceAt(position, sq);
      return p !== null && p.color === playerColor;
    },
    [position, playerColor],
  );

  const legalDestsFromServer = useMemo(() => {
    const map = new Map<string, SquareType[]>();
    if (legalMoves) {
      for (const m of legalMoves) {
        const existing = map.get(m.from) ?? [];
        existing.push(m.to);
        map.set(m.from, existing);
      }
    }
    return map;
  }, [legalMoves]);

  const getLegalDests = useCallback(
    (sq: SquareType): SquareType[] => {
      if (!isPlayerTurn || readOnly) return [];
      if (legalMoves) {
        return legalDestsFromServer.get(sq) ?? [];
      }
      return rules ? rules.getLegalMovesForSquare(position, sq) : [];
    },
    [isPlayerTurn, readOnly, legalMoves, legalDestsFromServer, rules, position],
  );

  const getLegalCaptures = useCallback(
    (sq: SquareType): SquareType[] => {
      if (!isPlayerTurn || readOnly) return [];
      return rules ? rules.getLegalCapturesForSquare(position, sq) : [];
    },
    [isPlayerTurn, readOnly, rules, position],
  );

  // Geometric premove destinations (no chess.js): squares the piece could
  // reach by its movement pattern, blockers and check ignored — the position
  // will change before the premove fires. validatePremove still gates the
  // queued move when the turn arrives.
  const getPremoveDests = useCallback(
    (sq: SquareType): SquareType[] => {
      if (isPlayerTurn || readOnly) return [];
      const p = getPieceAt(position, sq);
      if (!p || p.color !== playerColor) return [];
      return getPremoveDestinations(position, sq);
    },
    [isPlayerTurn, readOnly, position, playerColor],
  );

  // One destination source for the click/keyboard/drag paths: legal moves on
  // the player's turn, geometric premove targets off it — so premove hint
  // dots are clickable, not just decoration.
  const getDests = useCallback(
    (sq: SquareType): SquareType[] => (isPlayerTurn ? getLegalDests(sq) : getPremoveDests(sq)),
    [isPlayerTurn, getLegalDests, getPremoveDests],
  );

  const handleMove = useCallback(
    (intent: MoveIntent) => {
      if (!onMove || readOnly) return;

      const { from, to } = intent;
      if (!from || !to) return;

      clearShapes();

      if (isPromotion(from, to, position)) {
        setPromotion({ active: true, from, to });
        return;
      }

      if (!isPlayerTurn) {
        setPremove({ from, to });
        return;
      }

      onMove(intent);
    },
    [onMove, readOnly, position, isPlayerTurn, clearShapes],
  );

  const { selectedSquare, handleSquareClick, deselect } = useClickMove({
    legalDestinations: getDests,
    onMove: handleMove,
    isOwnPiece,
  });

  // Square detection is pure coordinate math against the board rect
  // (chessground-style) — document.elementFromPoint hit the grain overlay /
  // animation layer / drag ghost instead of the square on mobile, making
  // drops miss. The container's only in-flow child is the aspect-square
  // grid, so its rect IS the grid rect.
  const getSquareFromPoint = useCallback(
    (x: number, y: number): SquareType | null =>
      pointToSquare(
        containerRef.current?.getBoundingClientRect(),
        orientation,
        x,
        y,
        DROP_MARGIN_SQUARES,
      ),
    [orientation],
  );

  // Right-click drawing rides the same grid pointer handlers as the drag
  // system; both key off button/pointerId so they never cross. Drawing works
  // on readOnly boards too — annotating a review is the main use case.
  const {
    drawing,
    onDrawPointerDown,
    onDrawPointerMove,
    onDrawPointerUp,
    onDrawPointerCancel,
    onContextMenu,
  } = useDraw({
    getSquareFromPoint,
    onShapeComplete: handleShapeComplete,
  });

  const { dragState, pointerType, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useDrag({
      onDragStart: (sq) => {
        if (!isOwnPiece(sq) && isPlayerTurn) return;
        deselect();
      },
      onDragEnd: (from, to, drop) => {
        // Fat-finger forgiveness on touch: snap to the nearest legal dest
        // within range. Never snaps when the raw square is the origin, so
        // dropping the piece back still cancels. Dests are computed fresh
        // here (not from the dragDests memo): a pointerup in the same frame
        // as the drag-starting pointermove runs against a render where
        // dragState is still inactive and the memo is empty.
        if (to && from !== to && drop?.pointerType === 'touch') {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect && rect.width > 0) {
            to = snapToNearestDest(
              rect,
              orientation,
              getDests(from),
              to,
              drop.x,
              drop.y,
              TOUCH_SNAP_RADIUS_SQUARES,
            );
          }
        }
        if (!to || from === to) return;
        lastDragMoveRef.current = { from, to };
        handleMove({ from, to });
      },
      getSquareFromPoint,
    });

  // Legal dests of the drag origin, computed once per drag (not per
  // pointermove — the chess.js fallback path runs a full movegen).
  const dragDests = useMemo(
    () => (dragState.active && dragState.from ? getDests(dragState.from) : []),
    [dragState.active, dragState.from, getDests],
  );

  const dragOverSquare = useMemo(() => {
    if (!dragState.active) return null;
    const raw = getSquareFromPoint(dragState.x, dragState.y);
    // On touch the ring previews the square the drop will actually snap to.
    if (pointerType === 'touch' && raw && dragState.from && raw !== dragState.from) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        return snapToNearestDest(
          rect,
          orientation,
          dragDests,
          raw,
          dragState.x,
          dragState.y,
          TOUCH_SNAP_RADIUS_SQUARES,
        );
      }
    }
    return raw;
  }, [
    dragState.active,
    dragState.x,
    dragState.y,
    dragState.from,
    getSquareFromPoint,
    pointerType,
    dragDests,
    orientation,
  ]);

  const {
    focusSquare,
    selectedSquare: keyboardSelected,
    handleKeyDown,
  } = useKeyboard({
    orientation,
    legalDestinations: getDests,
    onMove: handleMove,
    isOwnPiece,
  });

  // Typed moves carry their promotion piece in the intent (the match list
  // shows all four), so they bypass handleMove's promotion dialog; the
  // overlay only opens on the player's turn, so the premove branch never
  // applies either.
  const handleTypedMove = useCallback(
    (intent: MoveIntent) => {
      if (!onMove || readOnly) return;
      clearShapes();
      onMove(intent);
    },
    [onMove, readOnly, clearShapes],
  );

  const canTextInput = !readOnly && !!onMove && isPlayerTurn;
  const moveInput = useMoveInput({
    fen: position,
    onMove: handleTypedMove,
    enabled: canTextInput,
  });

  // Board feedback while typing (2+ chars): every match's destination gets a
  // legal-move dot/ring; a partial-UCI query ("e2") also marks the origin.
  const inputDests = useMemo(() => {
    if (!moveInput.open || moveInput.query.trim().length < 2) return null;
    return new Set(moveInput.matches.map((m) => m.to));
  }, [moveInput.open, moveInput.query, moveInput.matches]);

  const inputOrigin = useMemo(() => {
    if (!moveInput.open || moveInput.query.trim().length < 2) return null;
    const sq = moveInput.query.trim().slice(0, 2).toLowerCase();
    if (!/^[a-h][1-8]$/.test(sq)) return null;
    return moveInput.matches.some((m) => m.from === sq) ? (sq as SquareType) : null;
  }, [moveInput.open, moveInput.query, moveInput.matches]);

  const effectiveSelected = selectedSquare ?? keyboardSelected;

  // Legal destinations on the player's turn, geometric premove targets off it.
  const selectedDests = useMemo(
    () => (effectiveSelected ? getDests(effectiveSelected) : []),
    [effectiveSelected, getDests],
  );

  const selectedCaptures = useMemo(
    () => (effectiveSelected ? getLegalCaptures(effectiveSelected) : []),
    [effectiveSelected, getLegalCaptures],
  );

  function handlePromotion(piece: PieceType) {
    if (!promotion.from || !promotion.to) return;
    setPromotion({ active: false, from: null, to: null });
    const intent: MoveIntent = { from: promotion.from, to: promotion.to, promotion: piece };

    if (!isPlayerTurn) {
      setPremove({ from: promotion.from, to: promotion.to, promotion: piece });
      return;
    }

    if (onMove) {
      onMove(intent);
    }
  }

  const squares = useMemo(() => {
    const result: Array<{
      square: SquareType;
      piece: Piece | null;
      fileIdx: number;
      rankIdx: number;
      isLight: boolean;
    }> = [];

    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
        const sq = getSquareAt(orientation, fileIdx, rankIdx);
        const piece = getPieceAtMemo(sq);
        result.push({
          square: sq,
          piece,
          fileIdx,
          rankIdx,
          isLight: isLightSquare(fileIdx, rankIdx),
        });
      }
    }
    return result;
  }, [orientation, getPieceAtMemo]);

  return (
    <div
      className={cn('relative w-full', className)}
      ref={containerRef}
      data-testid="chess-board"
      // Board-settings kill switch. animationMs is 0 when the user turns
      // animations off OR prefers reduced motion (board-context), so this
      // engages BOTH the globals.css `[data-no-animations] …` rules and the
      // `animationsDisabled()` JS helper for every surface that renders a
      // Chessboard (computer, live PvP, review).
      data-no-animations={settings.animationMs === 0 ? '' : undefined}
    >
      <div
        role="grid"
        aria-label="Chess board"
        tabIndex={0}
        className={cn(
          // aspect-square + grid-rows-8 size the cells from CSS alone, so the
          // server-rendered board paints at its final geometry pre-hydration
          // (no 512px default flash, and the piece <img>s are LCP-eligible
          // straight from the streamed HTML).
          // select-none kills text-selection across squares: without it a mouse
          // sweep selects the board, and dragging that selection spawns a native
          // multi-image drag ghost (every piece <img> in range) (bug-464).
          'grid aspect-square w-full select-none grid-cols-8 grid-rows-8 overflow-hidden rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // Squares set their own cursor; override them all while a drag is live.
          dragState.active && 'cursor-grabbing [&_[data-square]]:!cursor-grabbing',
        )}
        style={{ touchAction: 'none' }}
        onFocus={() => setShowKeyboardFocus(true)}
        onBlur={() => setShowKeyboardFocus(false)}
        onPointerDown={(e) => {
          if (e.button === 2) {
            onDrawPointerDown(e);
          } else if (e.button === 0) {
            // Any left press sweeps user annotations (chessground erase-on-click).
            clearShapes();
          }
        }}
        onPointerMove={(e) => {
          onPointerMove(e);
          onDrawPointerMove(e);
        }}
        onPointerUp={(e) => {
          onPointerUp(e);
          onDrawPointerUp(e);
        }}
        onPointerCancel={(e) => {
          onPointerCancel();
          onDrawPointerCancel(e);
        }}
        onContextMenu={onContextMenu}
        onKeyDown={(e) => {
          if (moveInput.open) {
            // Safety net — the overlay's own handler consumes keys (and stops
            // propagation) before they bubble here.
            moveInput.handleKeyDown(e);
            return;
          }
          if (
            canTextInput &&
            e.key.length === 1 &&
            /^[a-hnbrqko]$/i.test(e.key) &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
          ) {
            e.preventDefault();
            // While the board has focus, typed move chars win over the
            // page-level h/r/d/f/n shortcuts (use-game-keyboard); the
            // shortcuts still fire when focus is anywhere else.
            e.stopPropagation();
            moveInput.openWith(e.key);
            return;
          }
          handleKeyDown(e);
        }}
      >
        {/* role="grid" requires role="row" children wrapping the gridcells
            (ARIA grid pattern: grid → row → gridcell). `display: contents`
            keeps the row in the accessibility tree without disturbing the
            `grid grid-cols-8` layout — the 64 cells still flow into the parent
            grid. Without the row layer, axe flags aria-required-children /
            aria-required-parent on every board route. (S07) */}
        {Array.from({ length: 8 }, (_, rowIdx) => (
          <div key={`row-${rowIdx}`} role="row" style={{ display: 'contents' }}>
            {squares.slice(rowIdx * 8, rowIdx * 8 + 8).map(({ square, piece, isLight }) => {
              const legalDests = effectiveSelected ? selectedDests : [];
              const isLegalDest = legalDests.includes(square);
              // Off-turn the dests are geometric premoves; a hint square is a
              // "capture" simply when an enemy piece sits on it right now.
              const isCapture = isPlayerTurn
                ? selectedCaptures.includes(square)
                : isLegalDest && piece !== null && piece.color !== playerColor;
              const isPremoveDest = !isPlayerTurn && isLegalDest;
              const isInputDest = inputDests?.has(square) ?? false;
              const isInputCapture = isInputDest && piece !== null && piece.color !== playerColor;
              const isAnimTarget = anim?.pieces.some((p) => p.to === square) ?? false;
              const cursor = readOnly
                ? 'default'
                : piece && piece.color === playerColor
                  ? 'grab'
                  : isLegalDest
                    ? 'pointer'
                    : 'default';

              return (
                <Square
                  key={square}
                  square={square}
                  piece={piece}
                  hidePiece={isAnimTarget}
                  isLight={isLight}
                  isSelected={effectiveSelected === square}
                  isLegalMove={(isLegalDest && !isCapture) || (isInputDest && !isInputCapture)}
                  isLegalCapture={(isLegalDest && isCapture) || isInputCapture}
                  isPremoveDest={isPremoveDest}
                  isLastMoveFrom={lastMove?.from === square}
                  isLastMoveTo={lastMove?.to === square}
                  isInCheck={checkSquare === square}
                  isPremoveFrom={premove?.from === square}
                  isPreMoveTo={premove?.to === square}
                  isKeyboardFocus={
                    (showKeyboardFocus && focusSquare === square) || inputOrigin === square
                  }
                  isDragSource={dragState.active && dragState.from === square}
                  isDragOver={
                    dragState.active && dragOverSquare === square && dragState.from !== square
                  }
                  cursor={cursor}
                  ghostPiece={
                    premove?.to === square
                      ? (getPieceAt(position, premove.from) ?? undefined)
                      : undefined
                  }
                  ariaLabel={buildAriaLabel(square, piece, isLegalDest ? legalDests : [])}
                  onPointerDown={
                    readOnly
                      ? undefined
                      : (e, sq) => {
                          // Left button only — right button belongs to the
                          // annotation draw layer.
                          if (e.button !== 0) return;
                          if (isOwnPiece(sq) || !isPlayerTurn) {
                            onPointerDown(e, sq);
                          }
                        }
                  }
                  onClick={readOnly ? undefined : handleSquareClick}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Board surface material: top-light sheen + fine grain + a recessed
          inner lip against the frame. z-[1] sits above the square background
          colours but below the in-square highlight washes (z-[5]), hint dots
          (z-10) and pieces (z-20) — the squares' positioned children escape
          their unpositioned parents into this stacking context — so the grain
          tints the wood, never the pieces. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] rounded-[4px]"
        style={{
          // Sheen dark end is capped at 5% — beyond that the cross-board
          // luminance ramp reads as rank-dependent tinting (grubby home
          // ranks), not lighting.
          background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E"), linear-gradient(166deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 34%, rgba(0,0,0,0.03) 75%, rgba(0,0,0,0.05) 100%)`,
          boxShadow:
            'inset 0 1px 3px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(0,0,0,0.18), inset 0 -1px 1px rgba(255,255,255,0.04)',
        }}
      />

      {settings.coordinates && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <Coordinates orientation={orientation} />
        </div>
      )}

      {anim && <AnimationLayer anim={anim} orientation={orientation} />}

      <AnnotationLayer
        shapes={shapes}
        autoShapes={autoShapes}
        inProgress={
          drawing ? { from: drawing.from, to: drawing.current, color: drawing.color } : null
        }
        orientation={orientation}
      />

      {dragState.active &&
        dragState.from &&
        (() => {
          const p = getPieceAt(position, dragState.from);
          if (!p) return null;
          return <DragGhost piece={p} x={dragState.x} y={dragState.y} pointerType={pointerType} />;
        })()}

      <MoveInputOverlay {...moveInput} />

      {promotion.active && promotion.to && (
        <MoveInput
          color={playerColor}
          onSelect={handlePromotion}
          onCancel={() => setPromotion({ active: false, from: null, to: null })}
        />
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>
    </div>
  );
}

/**
 * Pointer-following drag piece. Mounts at rest under the pointer, then lifts
 * (offset + scale) over 80ms so the grab reads as picking the piece up. Touch
 * lifts higher so the piece stays visible above the finger.
 */
function DragGhost({
  piece,
  x,
  y,
  pointerType,
}: {
  piece: Piece;
  x: number;
  y: number;
  pointerType: string;
}) {
  const [lifted, setLifted] = useState(false);
  // animationsDisabled() covers both OS reduced motion and the board-settings
  // `data-no-animations` kill switch.
  const reduced = animationsDisabled();

  useLayoutEffect(() => {
    if (reduced) {
      setLifted(true);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setLifted(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const SvgComponent = getPieceSvg(piece.type, piece.color);
  const liftTransform =
    pointerType === 'touch'
      ? 'translate(-50%, -110%) scale(1.15)'
      : 'translate(-50%, -55%) scale(1.1)';

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: x,
        top: y,
        width: 'var(--board-sq-size)',
        height: 'var(--board-sq-size)',
        transform: lifted ? liftTransform : 'translate(-50%, -50%) scale(1)',
        transition: lifted && !reduced ? 'transform 80ms ease-out' : 'none',
      }}
    >
      <SvgComponent
        className={cn(
          'block h-full w-full',
          piece.color === 'b'
            ? 'drop-shadow-[0_7px_10px_rgba(0,0,0,0.55)]'
            : 'drop-shadow-[0_7px_10px_rgba(0,0,0,0.40)]',
        )}
      />
    </div>
  );
}
