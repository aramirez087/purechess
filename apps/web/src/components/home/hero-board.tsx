/* eslint-disable @next/next/no-img-element */

/**
 * Static board art for the home hero — "the board is the product", so the
 * hero shows the product. Renders the final position of the Immortal Game
 * (Anderssen–Kieseritzky, London 1851, after 23.Be7#) with the real board
 * palette and pieces. Server component: plain divs + <img>, no chess.js,
 * no interactivity.
 */

const IMMORTAL_FEN_BOARD = 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1';

/** Mating move 23.Be7# — highlighted like a live last move. */
const LAST_MOVE_SQUARES = new Set(['f6', 'e7']);

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

interface HeroSquare {
  square: string;
  isLight: boolean;
  piece: string | null; // e.g. "wK", "bQ"
}

function parseFenBoard(fenBoard: string): HeroSquare[] {
  const squares: HeroSquare[] = [];
  fenBoard.split('/').forEach((rankStr, rankIdx) => {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of rankStr) {
      const skip = Number(ch);
      if (Number.isFinite(skip)) {
        for (let i = 0; i < skip; i++) {
          squares.push(makeSquare(fileIdx++, rank, null));
        }
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        squares.push(makeSquare(fileIdx++, rank, `${color}${ch.toUpperCase()}`));
      }
    }
  });
  return squares;
}

function makeSquare(fileIdx: number, rank: number, piece: string | null): HeroSquare {
  return {
    square: `${FILES[fileIdx]}${rank}`,
    isLight: (fileIdx + rank) % 2 === 0,
    piece,
  };
}

const PIECE_NAMES: Record<string, string> = {
  K: 'king',
  Q: 'queen',
  R: 'rook',
  B: 'bishop',
  N: 'knight',
  P: 'pawn',
};

export function HeroBoard() {
  const squares = parseFenBoard(IMMORTAL_FEN_BOARD);

  return (
    <figure className="animate-rise-4 mx-auto w-full max-w-[34rem]">
      <div className="relative rounded-[14px] border border-[#2f372f] bg-gradient-to-b from-[#171b13] to-[#0e110c] p-2 shadow-[0_40px_100px_-28px_rgba(0,0,0,0.8),0_0_140px_-40px_rgba(214,181,99,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-2.5">
        <div className="overflow-hidden rounded-[7px] shadow-[0_0_0_1px_rgba(0,0,0,0.55)]">
          <div className="grid aspect-square grid-cols-8">
            {squares.map(({ square, isLight, piece }) => (
              <div
                key={square}
                className="relative"
                style={{
                  backgroundColor: isLight
                    ? 'hsl(var(--board-sq-light))'
                    : 'hsl(var(--board-sq-dark))',
                }}
              >
                {LAST_MOVE_SQUARES.has(square) && (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{ backgroundColor: 'hsl(var(--board-highlight-last))' }}
                  />
                )}
                {piece && (
                  <img
                    src={`/pieces/cburnett/${piece}.svg`}
                    alt=""
                    className="absolute inset-0 h-full w-full p-[4%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
        Anderssen – Kieseritzky · London 1851 · <span className="text-brass">23.Be7#</span>
      </figcaption>
    </figure>
  );
}
