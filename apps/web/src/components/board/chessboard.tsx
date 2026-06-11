'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square as SquareType, Piece, MoveIntent, PieceType, Color } from '@purechess/shared';
import type { ChessboardProps, Premove, PromotionState } from '@/lib/board/types';
import {
  getLegalMovesForSquare,
  getLegalCapturesForSquare,
  getPieceAt,
  fenToColorToMove,
  isPromotion,
  getCheckSquare,
} from '@/lib/board/position';
import { validatePremove } from '@/lib/board/premove';
import { getAnimationSquares, animationsDisabled } from '@/lib/board/animations';
import { soundEngine } from '@/lib/board/sound';
import { cn } from '@/lib/utils';
import { buildMoveAnnouncement } from '@/lib/board/sr-announce';
import { useBoardSettings } from './board-context';
import { useBoardResize } from './hooks/use-board-resize';
import { useDrag } from './hooks/use-drag';
import { useClickMove } from './hooks/use-click-move';
import { useKeyboard } from './hooks/use-keyboard';
import { useMoveAnimation, type DragMoveRef } from './hooks/use-move-animation';
import { getPieceSvg } from '@/lib/board/piece-svgs';
import { AnimationLayer } from './animation-layer';
import { Square } from './square';
import { Coordinates } from './coordinates';
import { MoveInput } from './move-input';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

function getSquareAt(orientation: 'white' | 'black', fileIdx: number, rankIdx: number): SquareType {
  const file = orientation === 'white' ? FILES[fileIdx] : FILES[7 - fileIdx];
  const rank = orientation === 'white' ? RANKS[rankIdx] : RANKS[7 - rankIdx];
  return `${file}${rank}` as SquareType;
}

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

  const anim = useMoveAnimation(position, lastDragMoveRef, settings.animationMs > 0);

  const colorToMove = useMemo(() => fenToColorToMove(position), [position]);
  const playerColor: Color = orientation === 'white' ? 'w' : 'b';
  const isPlayerTurn = colorToMove === playerColor;

  const checkSquare = useMemo(
    () => checkSquareProp ?? getCheckSquare(position),
    [checkSquareProp, position],
  );

  const [srAnnouncement, setSrAnnouncement] = useState('');
  const prevSrRef = useRef(position);

  useEffect(() => {
    const prev = prevSrRef.current;
    if (prev === position) return;
    prevSrRef.current = position;
    const msg = buildMoveAnnouncement(prev, position);
    if (msg) setSrAnnouncement(msg);
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

    const squares = getAnimationSquares(prev, position);
    if (!squares) return;
    try {
      const next = new Chess(position);
      if (next.isCheckmate()) {
        soundEngine.play('mate');
        return;
      }
      if (next.inCheck()) {
        soundEngine.play('check');
        return;
      }
    } catch {
      // unparseable FEN — fall through to the generic sound
    }
    soundEngine.play(squares.capturedAt ? 'capture' : 'move');
  }, [position, settings.sound]);

  useEffect(() => {
    if (!premove) return;
    if (!isPlayerTurn) return;

    const result = validatePremove(position, premove);
    setPremove(null);
    if (result && onMove) {
      onMove({ from: result.from, to: result.to, promotion: result.promotion });
    }
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
      return getLegalMovesForSquare(position, sq);
    },
    [isPlayerTurn, readOnly, legalMoves, legalDestsFromServer, position],
  );

  const getLegalCaptures = useCallback(
    (sq: SquareType): SquareType[] => {
      if (!isPlayerTurn || readOnly) return [];
      return getLegalCapturesForSquare(position, sq);
    },
    [isPlayerTurn, readOnly, position],
  );

  const handleMove = useCallback(
    (intent: MoveIntent) => {
      if (!onMove || readOnly) return;

      const { from, to } = intent;
      if (!from || !to) return;

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
    [onMove, readOnly, position, isPlayerTurn],
  );

  const { selectedSquare, handleSquareClick, deselect } = useClickMove({
    legalDestinations: getLegalDests,
    onMove: handleMove,
    isOwnPiece,
  });

  const getSquareFromPoint = useCallback((x: number, y: number): SquareType | null => {
    const el = document.elementFromPoint(x, y);
    const sq = el?.closest('[data-square]');
    if (!sq) return null;
    return sq.getAttribute('data-square') as SquareType | null;
  }, []);

  const { dragState, pointerType, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useDrag({
      onDragStart: (sq) => {
        if (!isOwnPiece(sq) && isPlayerTurn) return;
        deselect();
      },
      onDragEnd: (from, to) => {
        if (!to || from === to) return;
        lastDragMoveRef.current = { from, to };
        handleMove({ from, to });
      },
      getSquareFromPoint,
    });

  const dragOverSquare = useMemo(
    () => (dragState.active ? getSquareFromPoint(dragState.x, dragState.y) : null),
    [dragState.active, dragState.x, dragState.y, getSquareFromPoint],
  );

  const {
    focusSquare,
    selectedSquare: keyboardSelected,
    handleKeyDown,
  } = useKeyboard({
    orientation,
    legalDestinations: getLegalDests,
    onMove: handleMove,
    isOwnPiece,
  });

  const effectiveSelected = selectedSquare ?? keyboardSelected;

  const selectedDests = useMemo(
    () => (effectiveSelected ? getLegalDests(effectiveSelected) : []),
    [effectiveSelected, getLegalDests],
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
          'grid grid-cols-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // Squares set their own cursor; override them all while a drag is live.
          dragState.active && 'cursor-grabbing [&_[data-square]]:!cursor-grabbing',
        )}
        style={{ touchAction: 'none' }}
        onFocus={() => setShowKeyboardFocus(true)}
        onBlur={() => setShowKeyboardFocus(false)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={handleKeyDown}
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
              const isCapture = selectedCaptures.includes(square);
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
                  isLegalMove={isLegalDest && !isCapture}
                  isLegalCapture={isLegalDest && isCapture}
                  isLastMoveFrom={lastMove?.from === square}
                  isLastMoveTo={lastMove?.to === square}
                  isInCheck={checkSquare === square}
                  isPremoveFrom={premove?.from === square}
                  isPreMoveTo={premove?.to === square}
                  isKeyboardFocus={showKeyboardFocus && focusSquare === square}
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

      {settings.coordinates && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <Coordinates orientation={orientation} />
        </div>
      )}

      {anim && <AnimationLayer anim={anim} orientation={orientation} />}

      {dragState.active &&
        dragState.from &&
        (() => {
          const p = getPieceAt(position, dragState.from);
          if (!p) return null;
          return <DragGhost piece={p} x={dragState.x} y={dragState.y} pointerType={pointerType} />;
        })()}

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
