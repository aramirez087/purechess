import type { FC, ReactNode } from 'react';
import type { PieceType, Color } from '@purechess/shared';

interface SvgProps {
  className?: string;
}

interface PieceSvgProps extends SvgProps {
  type: PieceType;
  color: Color;
}

interface PiecePalette {
  fill: string;
  stroke: string;
  accent: string;
  soft: string;
}

const PALETTES: Record<Color, PiecePalette> = {
  w: {
    fill: '#f7f1df',
    stroke: '#20291f',
    accent: '#b98923',
    soft: '#fff9eb',
  },
  b: {
    fill: '#151a15',
    stroke: '#efe7d5',
    accent: '#d6b563',
    soft: '#2b332c',
  },
};

const shapeStroke = {
  strokeWidth: 2.85,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const;

const detailStroke = {
  strokeWidth: 2.35,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const;

function PieceFrame({ className, children }: SvgProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function Base({ palette, compact = false }: { palette: PiecePalette; compact?: boolean }) {
  const upper = compact ? 'M22 45.5h20l4.5 6.5h-29z' : 'M17.5 45.5h29l4.5 6.5H13z';
  const lower = compact
    ? 'M17.5 52h29c2.2 0 4 1.7 4.4 4H13.1c.4-2.3 2.2-4 4.4-4z'
    : 'M12.5 52h39c2.2 0 4 1.7 4.4 4H8.1c.4-2.3 2.2-4 4.4-4z';
  const band = compact ? 'M20.5 51.7h23' : 'M15.5 51.7h33';

  return (
    <>
      <path d={upper} fill={palette.fill} stroke={palette.stroke} {...shapeStroke} />
      <path d={lower} fill={palette.fill} stroke={palette.stroke} {...shapeStroke} />
      <path d={band} fill="none" stroke={palette.accent} {...detailStroke} />
    </>
  );
}

function PawnGlyph({ palette }: { palette: PiecePalette }) {
  return (
    <>
      <path
        d="M24.5 45.8c.35-7.8 4.25-13 7.5-15.3 3.25 2.3 7.15 7.5 7.5 15.3z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <circle
        cx="32"
        cy="20.8"
        r="9.6"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path d="M26 35h12" fill="none" stroke={palette.accent} {...detailStroke} />
      <path
        d="M29.2 17.4c1.05-1.35 2.6-2.05 4.45-2.05"
        fill="none"
        stroke={palette.soft}
        {...detailStroke}
      />
      <Base palette={palette} compact />
    </>
  );
}

function RookGlyph({ palette }: { palette: PiecePalette }) {
  return (
    <>
      <path
        d="M16 13h8v6.5h5V13h6v6.5h5V13h8v15.2L43.5 33v13.2h-23V33L16 28.2z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M19 28.5h26M22 35.5h20M23.5 43.5h17"
        fill="none"
        stroke={palette.accent}
        {...detailStroke}
      />
      <Base palette={palette} />
    </>
  );
}

function KnightGlyph({ palette }: { palette: PiecePalette }) {
  return (
    <>
      <path
        d="M18.5 56c.55-8.45 4.65-13.35 10.9-18.15 2.75-2.1 3.75-5.45 1.65-10.65l-6.55 5.25-7.8-1.65 6.1-9.7c3.75-5.95 9.25-9.65 16.35-11.1 2.15 5.8 6.4 10.2 10.55 16.55l-4.7 6.15-8.7-.75-2.25 5.1C39.9 41.85 43.2 48 43.75 56z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M35.9 15.7c-.45 6.65-2.9 11.8-7.7 15.65M30.8 37.7c3.5 2.55 5.9 5.95 7.15 10.15"
        fill="none"
        stroke={palette.accent}
        {...detailStroke}
      />
      <path d="M37.1 26.2h5.4" fill="none" stroke={palette.stroke} {...detailStroke} />
      <circle
        cx="33.7"
        cy="21.3"
        r="1.75"
        fill={palette.accent}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <path d="M22.4 50.8h20.4" fill="none" stroke={palette.accent} {...detailStroke} />
    </>
  );
}

function BishopGlyph({ palette }: { palette: PiecePalette }) {
  return (
    <>
      <circle
        cx="32"
        cy="9.8"
        r="4.5"
        fill={palette.accent}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M32 14.2c8.55 5.45 12.45 12.5 10.85 20.6-.9 4.75-4.15 8.4-8.35 10.3h-5c-4.2-1.9-7.45-5.55-8.35-10.3C19.55 26.7 23.45 19.65 32 14.2z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M38.2 22.6 26.7 37.4M25.2 45.5h13.6"
        fill="none"
        stroke={palette.accent}
        {...detailStroke}
      />
      <Base palette={palette} compact />
    </>
  );
}

function QueenGlyph({ palette }: { palette: PiecePalette }) {
  return (
    <>
      <path
        d="M14.5 30.6 10.5 16l10.8 8.55L25.35 12 32 24.2 38.65 12l4.05 12.55L53.5 16l-4 14.6z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <circle
        cx="10.5"
        cy="15.5"
        r="3.4"
        fill={palette.accent}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      <circle
        cx="25.35"
        cy="11.5"
        r="3.4"
        fill={palette.accent}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      <circle
        cx="32"
        cy="9.5"
        r="3.6"
        fill={palette.accent}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      <circle
        cx="38.65"
        cy="11.5"
        r="3.4"
        fill={palette.accent}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      <circle
        cx="53.5"
        cy="15.5"
        r="3.4"
        fill={palette.accent}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      <path
        d="M18.5 31.5c8.55-2.25 18.45-2.25 27 0l-3.1 14.4H21.6z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M20.3 35.8c7.3-1.6 16.1-1.6 23.4 0M22.5 42h19"
        fill="none"
        stroke={palette.accent}
        {...detailStroke}
      />
      <Base palette={palette} />
    </>
  );
}

function KingGlyph({ palette }: { palette: PiecePalette }) {
  return (
    <>
      <path
        d="M32 7v11.5M26.5 12.5h11"
        fill="none"
        stroke={palette.accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M22.2 25.3c0-6.4 4.8-9.75 9.8-6.4 5-3.35 9.8 0 9.8 6.4 0 5.5-5.55 7.4-7.35 13.1h-4.9C27.75 32.7 22.2 30.8 22.2 25.3z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M23.6 39.2h16.8l3.3 6.7H20.3z"
        fill={palette.fill}
        stroke={palette.stroke}
        {...shapeStroke}
      />
      <path
        d="M25.2 33.4c4.25 2.35 9.35 2.35 13.6 0M25.8 43.4h12.4"
        fill="none"
        stroke={palette.accent}
        {...detailStroke}
      />
      <Base palette={palette} />
    </>
  );
}

function PieceGlyph({ type, color, className }: PieceSvgProps) {
  const palette = PALETTES[color];

  return (
    <PieceFrame className={className}>
      {type === 'p' && <PawnGlyph palette={palette} />}
      {type === 'n' && <KnightGlyph palette={palette} />}
      {type === 'b' && <BishopGlyph palette={palette} />}
      {type === 'r' && <RookGlyph palette={palette} />}
      {type === 'q' && <QueenGlyph palette={palette} />}
      {type === 'k' && <KingGlyph palette={palette} />}
    </PieceFrame>
  );
}

export function WKing({ className }: SvgProps) {
  return <PieceGlyph type="k" color="w" className={className} />;
}

export function WQueen({ className }: SvgProps) {
  return <PieceGlyph type="q" color="w" className={className} />;
}

export function WRook({ className }: SvgProps) {
  return <PieceGlyph type="r" color="w" className={className} />;
}

export function WBishop({ className }: SvgProps) {
  return <PieceGlyph type="b" color="w" className={className} />;
}

export function WKnight({ className }: SvgProps) {
  return <PieceGlyph type="n" color="w" className={className} />;
}

export function WPawn({ className }: SvgProps) {
  return <PieceGlyph type="p" color="w" className={className} />;
}

export function BKing({ className }: SvgProps) {
  return <PieceGlyph type="k" color="b" className={className} />;
}

export function BQueen({ className }: SvgProps) {
  return <PieceGlyph type="q" color="b" className={className} />;
}

export function BRook({ className }: SvgProps) {
  return <PieceGlyph type="r" color="b" className={className} />;
}

export function BBishop({ className }: SvgProps) {
  return <PieceGlyph type="b" color="b" className={className} />;
}

export function BKnight({ className }: SvgProps) {
  return <PieceGlyph type="n" color="b" className={className} />;
}

export function BPawn({ className }: SvgProps) {
  return <PieceGlyph type="p" color="b" className={className} />;
}

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
