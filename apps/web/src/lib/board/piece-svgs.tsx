import type { PieceType, Color } from '@purechess/shared';

interface SvgProps {
  className?: string;
}

// Brand Colors from design.md:
// Stage: #0b0d0b
// Surface: #121511
// Text/Ivory: #f1eee6
// Accent Brass: #d6b563
// Border/Slate: #2b332c

export function WKing({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#f1eee6" stroke="#2b332c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Cross on top - Brass */}
        <path d="M22.5 11.63V6" stroke="#d6b563" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 8h5" stroke="#d6b563" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
          strokeLinecap="butt"
        />
        <path
          d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 6 10.5 6 10.5v7"
        />
        {/* Jewelry bands - Brass */}
        <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" stroke="#d6b563" />
      </g>
    </svg>
  );
}

export function WQueen({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#f1eee6" stroke="#2b332c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Crown base path */}
        <path
          d="M9 26c8.5-8.5 15.5-8.5 27 0l2.5-12.5L31 25l-.3-14.1-8.2 13.4-8.2-13.4L14 25 6.5 13.5 9 26z"
          strokeLinecap="butt"
        />
        <path
          d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"
          strokeLinecap="butt"
        />
        {/* Horizontal bands - Brass */}
        <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c4-1.5 17-1.5 21 0" stroke="#d6b563" />
        {/* Crown points circles - Solid Brass */}
        <circle cx="6" cy="12" r="2.75" fill="#d6b563" />
        <circle cx="14" cy="9" r="2.75" fill="#d6b563" />
        <circle cx="22.5" cy="8" r="2.75" fill="#d6b563" />
        <circle cx="31" cy="9" r="2.75" fill="#d6b563" />
        <circle cx="39" cy="12" r="2.75" fill="#d6b563" />
      </g>
    </svg>
  );
}

export function WRook({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#f1eee6" stroke="#2b332c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5" strokeLinecap="butt" />
        <path d="M34 14l-3 3H14l-3-3" />
        <path d="M31 17v12.5H14V17" strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
        {/* Highlight line - Brass */}
        <path d="M11 14h23" fill="none" stroke="#d6b563" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}

export function WBishop({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#f1eee6" stroke="#2b332c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <g strokeLinecap="butt">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
        </g>
        {/* Inner lines & cross - Brass */}
        <path d="M17.5 26h10M15 30h15" stroke="#d6b563" />
        <path d="M22.5 11.5v5M20 18h5" stroke="#d6b563" strokeLinejoin="miter" />
        {/* Top ball - Solid Brass */}
        <circle cx="22.5" cy="8" r="2.5" fill="#d6b563" />
      </g>
    </svg>
  );
}

export function WKnight({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#f1eee6" stroke="#2b332c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
        {/* Mane details - Brass */}
        <path d="M24 18c.38 5.12-2.21 7.59-4 10-2.5 3.5-3 6-3 6 5.5-1 8.5-5.5 8.5-5.5-.5 2.5-3 4.5-3 4.5s3-1 4.5-3c.5-1 1-3.5 1-3.5 1 2 .5 4.5.5 4.5 4.5-3.5 3.5-13.5 1.5-19.5" stroke="#d6b563" />
        {/* Eye - Solid Brass */}
        <path d="M14.933 15.75a5 10.5 30 110-1 5 10.5 30 010 1z" fill="#d6b563" stroke="#2b332c" />
        <path d="M9.5 25.5a.5.5 0 11-1 0 .5.5 0 011 0z" fill="#2b332c" stroke="#2b332c" />
      </g>
    </svg>
  );
}

export function WPawn({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#f1eee6" stroke="#2b332c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
        />
        {/* Head center detail - Solid Brass */}
        <circle cx="22.5" cy="13" r="2" fill="#d6b563" stroke="#2b332c" strokeWidth="1" />
      </g>
    </svg>
  );
}

export function BKing({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#181c17" stroke="#d6b563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Cross on top - Ivory */}
        <path d="M22.5 11.63V6" stroke="#f1eee6" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 8h5" stroke="#f1eee6" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
          strokeLinecap="butt"
        />
        <path
          d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 6 10.5 6 10.5v7"
        />
        {/* Jewelry bands - Ivory */}
        <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" stroke="#f1eee6" />
      </g>
    </svg>
  );
}

export function BQueen({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#181c17" stroke="#d6b563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Crown base path */}
        <path
          d="M9 26c8.5-8.5 15.5-8.5 27 0l2.5-12.5L31 25l-.3-14.1-8.2 13.4-8.2-13.4L14 25 6.5 13.5 9 26z"
          strokeLinecap="butt"
        />
        <path
          d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"
          strokeLinecap="butt"
        />
        {/* Horizontal bands - Ivory */}
        <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c4-1.5 17-1.5 21 0" stroke="#f1eee6" />
        {/* Crown points circles - Solid Ivory */}
        <circle cx="6" cy="12" r="2.75" fill="#f1eee6" stroke="#d6b563" />
        <circle cx="14" cy="9" r="2.75" fill="#f1eee6" stroke="#d6b563" />
        <circle cx="22.5" cy="8" r="2.75" fill="#f1eee6" stroke="#d6b563" />
        <circle cx="31" cy="9" r="2.75" fill="#f1eee6" stroke="#d6b563" />
        <circle cx="39" cy="12" r="2.75" fill="#f1eee6" stroke="#d6b563" />
      </g>
    </svg>
  );
}

export function BRook({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#181c17" stroke="#d6b563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5H11z" strokeLinecap="butt" />
        <path d="M34 14l-3 3H14l-3-3" />
        <path d="M31 17v12.5H14V17" strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
        {/* Highlight line - Ivory */}
        <path d="M11 14h23" fill="none" stroke="#f1eee6" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}

export function BBishop({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#181c17" stroke="#d6b563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <g strokeLinecap="butt">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
        </g>
        {/* Inner lines & cross - Ivory */}
        <path d="M17.5 26h10M15 30h15" stroke="#f1eee6" />
        <path d="M22.5 11.5v5M20 18h5" stroke="#f1eee6" strokeLinejoin="miter" />
        {/* Top ball - Solid Ivory */}
        <circle cx="22.5" cy="8" r="2.5" fill="#f1eee6" stroke="#d6b563" />
      </g>
    </svg>
  );
}

export function BKnight({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#181c17" stroke="#d6b563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
        {/* Mane details - Ivory */}
        <path d="M24 18c.38 5.12-2.21 7.59-4 10-2.5 3.5-3 6-3 6 5.5-1 8.5-5.5 8.5-5.5-.5 2.5-3 4.5-3 4.5s3-1 4.5-3c.5-1 1-3.5 1-3.5 1 2 .5 4.5.5 4.5 4.5-3.5 3.5-13.5 1.5-19.5" stroke="#f1eee6" />
        {/* Eye - Solid Ivory */}
        <path d="M14.933 15.75a5 10.5 30 110-1 5 10.5 30 010 1z" fill="#f1eee6" stroke="#d6b563" />
        <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#d6b563" stroke="#d6b563" />
      </g>
    </svg>
  );
}

export function BPawn({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden="true">
      <g fill="#181c17" stroke="#d6b563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
        />
        {/* Head center detail - Solid Ivory */}
        <circle cx="22.5" cy="13" r="2" fill="#f1eee6" stroke="#d6b563" strokeWidth="1" />
      </g>
    </svg>
  );
}

const PIECE_MAP: Record<string, React.FC<SvgProps>> = {
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

export function getPieceSvg(type: PieceType, color: Color): React.FC<SvgProps> {
  const key = `${color}${type}`;
  return PIECE_MAP[key] ?? WPawn;
}
