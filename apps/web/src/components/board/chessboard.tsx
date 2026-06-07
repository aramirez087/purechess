'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square as SquareType, Piece, Move, MoveIntent, PieceType, Color } from '@purchess/shared';
import type { ChessboardProps, Premove, PromotionState } from '@/lib/board/types';
import { getLegalMovesForSquare, getLegalCapturesForSquare, getPieceAt, fenToColorToMove, isPromotion, getCheckSquare } from '@/lib/board/position';
import { validatePremove } from '@/lib/board/premove';
import { soundEngine } from '@/lib/board/sound';
import { cn } from '@/lib/utils';
import { useBoardSettings } from './board-context';
import { useBoardResize } from './hooks/use-board-resize';
import { useDrag } from './hooks/use-drag';
import { useClickMove } from './hooks/use-click-move';
import { useKeyboard } from './hooks/use-keyboard';
import { getPieceSvg } from '@/lib/board/piece-svgs';
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
    const typeName = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[piece.type] ?? piece.type;
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
  const [promotion, setPromotion] = useState<PromotionState>({ active: false, from: null, to: null });

  const colorToMove = useMemo(() => fenToColorToMove(position), [position]);
  const playerColor: Color = orientation === 'white' ? 'w' : 'b';
  const isPlayerTurn = colorToMove === playerColor;

  const checkSquare = useMemo(
    () => checkSquareProp ?? getCheckSquare(position),
    [checkSquareProp, position],
  );

  useEffect(() => {
    if (!premove) return;
    if (!isPlayerTurn) return;

    const result = validatePremove(position, premove);
    setPremove(null);
    if (result && onMove) {
      onMove({ from: result.from, to: result.to, promotion: result.promotion });
      if (settings.sound) soundEngine.play('move');
    }
  }, [position, isPlayerTurn, premove, onMove, settings.sound]);

  const getPieceAtMemo = useCallback(
    (sq: SquareType) => getPieceAt(position, sq),
    [position],
  );

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
      if (settings.sound) soundEngine.play('move');
    },
    [onMove, readOnly, position, isPlayerTurn, settings.sound],
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

  const { dragState, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useDrag({
    onDragStart: (sq) => {
      if (!isOwnPiece(sq) && isPlayerTurn) return;
      deselect();
    },
    onDragEnd: (from, to) => {
      if (!to || from === to) return;
      handleMove({ from, to });
    },
    getSquareFromPoint,
  });

  const { focusSquare, selectedSquare: keyboardSelected, handleKeyDown } = useKeyboard({
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
      if (settings.sound) soundEngine.play('move');
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
      className={cn('relative w-full max-w-[720px] mx-auto', className)}
      ref={containerRef}
    >
      {settings.coordinates && (
        <div className="relative">
          <Coordinates orientation={orientation} />
        </div>
      )}
      <div
        role="grid"
        aria-label="Chess board"
        tabIndex={0}
        className="grid grid-cols-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={handleKeyDown}
      >
        {squares.map(({ square, piece, fileIdx, rankIdx, isLight }) => {
          const legalDests = effectiveSelected ? selectedDests : [];
          const isLegalDest = legalDests.includes(square);
          const isCapture = selectedCaptures.includes(square);

          return (
            <Square
              key={square}
              square={square}
              piece={piece}
              isLight={isLight}
              isSelected={effectiveSelected === square}
              isLegalMove={isLegalDest && !isCapture}
              isLegalCapture={isLegalDest && isCapture}
              isLastMoveFrom={lastMove?.from === square}
              isLastMoveTo={lastMove?.to === square}
              isInCheck={checkSquare === square}
              isPremoveFrom={premove?.from === square}
              isPreMoveTo={premove?.to === square}
              isKeyboardFocus={focusSquare === square}
              isDragSource={dragState.active && dragState.from === square}
              ghostPiece={premove?.to === square ? (getPieceAt(position, premove.from) ?? undefined) : undefined}
              ariaLabel={buildAriaLabel(square, piece, isLegalDest ? legalDests : [])}
              onPointerDown={readOnly ? undefined : (e, sq) => {
                if (isOwnPiece(sq) || !isPlayerTurn) {
                  onPointerDown(e, sq);
                }
              }}
              onClick={readOnly ? undefined : handleSquareClick}
            />
          );
        })}
      </div>

      {dragState.active && dragState.from && (() => {
        const p = getPieceAt(position, dragState.from);
        if (!p) return null;
        const SvgComponent = getPieceSvg(p.type, p.color);
        return (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: dragState.x,
              top: dragState.y,
              width: 'var(--board-sq-size)',
              height: 'var(--board-sq-size)',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <SvgComponent className="w-full h-full" />
          </div>
        );
      })()}

      {promotion.active && promotion.to && (
        <MoveInput
          color={playerColor}
          onSelect={handlePromotion}
          onCancel={() => setPromotion({ active: false, from: null, to: null })}
        />
      )}
    </div>
  );
}

