'use client';

import { Trash2 } from 'lucide-react';
import type { PieceType, Color } from '@purechess/shared';
import { Piece } from '@/components/board/piece';
import type { EditorPiece } from '@/lib/board/editor-state';
import { cn } from '@/lib/utils';

/** A palette selection is either a piece to place or the trash (click-to-remove) tool. */
export type PaletteSelection = EditorPiece | 'trash';

interface PiecePaletteProps {
  active: PaletteSelection | null;
  onSelect: (selection: PaletteSelection | null) => void;
}

const ORDER: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];
const COLORS: Color[] = ['w', 'b'];

const RING_ACTIVE = 'ring-1 ring-brass';

function isSamePiece(a: PaletteSelection | null, type: PieceType, color: Color): boolean {
  return a !== null && a !== 'trash' && a.type === type && a.color === color;
}

export function PiecePalette({ active, onSelect }: PiecePaletteProps) {
  return (
    <div
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-1"
      role="toolbar"
      aria-label="Piece palette"
    >
      {COLORS.flatMap((color) =>
        ORDER.map((type) => {
          const selected = isSamePiece(active, type, color);
          return (
            <button
              key={`${color}${type}`}
              type="button"
              aria-label={`${color === 'w' ? 'White' : 'Black'} ${type}`}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : { type, color })}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-md border border-border/60 bg-raised/40 transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && RING_ACTIVE,
              )}
            >
              <span className="h-8 w-8">
                <Piece type={type} color={color} />
              </span>
            </button>
          );
        }),
      )}
      <button
        type="button"
        aria-label="Trash — click a square to remove its piece"
        aria-pressed={active === 'trash'}
        onClick={() => onSelect(active === 'trash' ? null : 'trash')}
        className={cn(
          'col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-md border border-border/60 bg-raised/40 text-muted-foreground transition-colors hover:bg-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-1 sm:w-11',
          active === 'trash' && `${RING_ACTIVE} text-foreground`,
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
