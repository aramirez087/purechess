import type { FC } from 'react';
import type { PieceType, Color } from '@purechess/shared';

interface SvgProps {
  className?: string;
}

/**
 * Pieces are served from the vendored cburnett set (lichess default, by
 * Colin M.L. Burnett, CC-BY-SA 3.0) in `public/pieces/cburnett/`. The public
 * API here is unchanged — `getPieceSvg(type, color)` returns a component that
 * accepts a `className` — so the board, the floating drag layer, and the
 * captured-material strip all keep working untouched. Each component renders an
 * `<img>`; the `className` it receives carries `h-full w-full` sizing and the
 * `drop-shadow-[…]` filter (which applies to the SVG's alpha just like an inline
 * `<svg>`), so piece shadows survive.
 */

const PIECE_LETTER: Record<PieceType, string> = {
  k: 'K',
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
  p: 'P',
};

function makePiece(color: Color, type: PieceType): FC<SvgProps> {
  const src = `/pieces/cburnett/${color}${PIECE_LETTER[type]}.svg`;
  const PieceImg: FC<SvgProps> = ({ className }) => (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static same-origin SVG; next/image is overkill and CSP img-src 'self' already covers it
    <img src={src} alt="" aria-hidden="true" draggable={false} className={className} />
  );
  PieceImg.displayName = `Piece_${color}${type}`;
  return PieceImg;
}

export const WKing = makePiece('w', 'k');
export const WQueen = makePiece('w', 'q');
export const WRook = makePiece('w', 'r');
export const WBishop = makePiece('w', 'b');
export const WKnight = makePiece('w', 'n');
export const WPawn = makePiece('w', 'p');

export const BKing = makePiece('b', 'k');
export const BQueen = makePiece('b', 'q');
export const BRook = makePiece('b', 'r');
export const BBishop = makePiece('b', 'b');
export const BKnight = makePiece('b', 'n');
export const BPawn = makePiece('b', 'p');

const PIECE_MAP: Record<string, FC<SvgProps>> = {
  wk: WKing,
  wq: WQueen,
  wr: WRook,
  wb: WBishop,
  wn: WKnight,
  wp: WPawn,
  bk: BKing,
  bq: BQueen,
  br: BRook,
  bb: BBishop,
  bn: BKnight,
  bp: BPawn,
};

export function getPieceSvg(type: PieceType, color: Color): FC<SvgProps> {
  const key = `${color}${type}`;
  return PIECE_MAP[key] ?? WPawn;
}
