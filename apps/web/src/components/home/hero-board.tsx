'use client';

/* eslint-disable @next/next/no-img-element */

/**
 * Board art for the home hero — "the board is the product", so the hero
 * shows the product. Renders the final position of the Immortal Game
 * (Anderssen–Kieseritzky, London 1851, after 23.Be7#) with the real board
 * palette and pieces.
 *
 * Enhancement: the first time the board scrolls ~60% into view it replays
 * the queen sacrifice — 22.Qf6+ Nxf6 23.Be7# — with the product's move
 * feel (200ms cubic-bezier slide, capture victim holds then fades, settle
 * scale; see components/board/animation-layer.tsx, mirrored locally) and
 * settles back on the exact static final position. The static markup is
 * the default, so SSR / no-JS / prefers-reduced-motion users get today's
 * still image.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const IMMORTAL_FEN_BOARD = 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1';

/** Mating move 23.Be7# — highlighted like a live last move. */
const LAST_MOVE_SQUARES = new Set(['f6', 'e7']);

/**
 * Replay positions (board field only), verified with chess.js by playing
 * the full Immortal Game move list. Index 0 is the position after
 * 21...Kd8 — the moment before the queen sacrifice.
 */
const REPLAY_POSITIONS = [
  'r1bk2nr/p2p1pNp/n2B4/1p1NP2P/6P1/3P1Q2/P1P1K3/q5b1', // after 21...Kd8
  'r1bk2nr/p2p1pNp/n2B1Q2/1p1NP2P/6P1/3P4/P1P1K3/q5b1', // after 22.Qf6+
  'r1bk3r/p2p1pNp/n2B1n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1', // after 22...Nxf6
  IMMORTAL_FEN_BOARD, // after 23.Be7#
];

interface ReplayPly {
  from: string;
  to: string;
  piece: string; // mover, e.g. "wQ"
  victim?: string; // captured piece — holds its square, then fades
  highlight: [string, string];
}

const REPLAY_PLIES: ReplayPly[] = [
  { from: 'f3', to: 'f6', piece: 'wQ', highlight: ['f3', 'f6'] }, // 22.Qf6+
  { from: 'g8', to: 'f6', piece: 'bN', victim: 'wQ', highlight: ['g8', 'f6'] }, // 22...Nxf6
  { from: 'd6', to: 'e7', piece: 'wB', highlight: ['f6', 'e7'] }, // 23.Be7# — lands on the static highlight
];

/* Move feel — same voice as components/board/animation-layer.tsx. */
const MOVE_MS = 200;
const MOVE_EASE = 'cubic-bezier(0.25, 0.9, 0.3, 1)';
const CAPTURE_FADE_MS = 90;
const SETTLE_MS = 60;
const PRE_REPLAY_HOLD_MS = 700;
const INTER_PLY_MS = MOVE_MS + 700; // slide, then a beat before the next ply
const DONE_STEP = REPLAY_PLIES.length + 1; // overlay gone, static markup again

const EMPTY_HIGHLIGHT = new Set<string>();

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

/* Corner coordinates, matching the live board's Coordinates component: the
   hero board has no --board-sq-size, so scale against the viewport instead. */
const COORD_FONT_SIZE = 'clamp(8px, 0.9vw, 12px)';

function coordTint(isLight: boolean): string {
  return isLight
    ? 'hsl(var(--board-sq-dark) / 0.85)'
    : 'hsl(var(--board-sq-light) / 0.85)';
}

/**
 * The persisted board-settings animations toggle, read straight from
 * localStorage (zustand persist envelope): the settings provider that
 * normally hydrates the store does not mount on marketing surfaces, and the
 * data-no-animations attribute is only ever emitted by a mounted Chessboard —
 * which the hero is not.
 */
function boardAnimationsDisabled(): boolean {
  try {
    const raw = window.localStorage.getItem('purechess-settings');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { animations?: boolean } };
    return parsed.state?.animations === false;
  } catch {
    return false;
  }
}

export function HeroBoard() {
  /**
   * null = static final position (SSR default). 0 = pre-sac position held,
   * 1..3 = ply N in flight, DONE_STEP = replay finished (static again).
   */
  const [step, setStep] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const figureRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Arm the one-shot replay trigger. Pure enhancement: bail on reduced
  // motion, the user's stored animations-off preference, or a missing
  // observer.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (boardAnimationsDisabled()) return;
    const el = figureRef.current;
    if (!el) return;
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired || !entries.some((entry) => entry.isIntersecting)) return;
        fired = true;
        io.disconnect();
        setStep(0);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Timeline: hold the pre-sac position for a beat, then one ply per beat.
  useEffect(() => {
    if (step === null || step >= DONE_STEP) return;
    const delay =
      step === 0
        ? PRE_REPLAY_HOLD_MS
        : step === REPLAY_PLIES.length
          ? MOVE_MS + SETTLE_MS + 40 // let the mate settle, then drop the overlay
          : INTER_PLY_MS;
    const timer = setTimeout(() => setStep(step + 1), delay);
    return () => clearTimeout(timer);
  }, [step]);

  const replaying = step !== null && step < DONE_STEP;
  const posIdx = replaying ? Math.min(step, REPLAY_POSITIONS.length - 1) : REPLAY_POSITIONS.length - 1;
  const anim = replaying && step >= 1 ? REPLAY_PLIES[step - 1] : null;
  const highlight = !replaying
    ? LAST_MOVE_SQUARES
    : step === 0
      ? EMPTY_HIGHLIGHT
      : new Set(REPLAY_PLIES[step - 1].highlight);

  const squares = parseFenBoard(REPLAY_POSITIONS[posIdx]);

  return (
    <figure ref={figureRef} className={`${mounted ? 'animate-rise-4 ' : ''}mx-auto w-full max-w-[34rem]`}>
      <div className="relative rounded-[14px] border border-[#2f372f] bg-gradient-to-b from-[#171b13] to-[#0e110c] p-2 shadow-[0_40px_100px_-28px_rgba(0,0,0,0.8),0_0_140px_-40px_rgba(214,181,99,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-2.5">
        <div className="relative overflow-hidden rounded-[7px] shadow-[0_0_0_1px_rgba(0,0,0,0.55)]">
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
                {highlight.has(square) && (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{ backgroundColor: 'hsl(var(--board-highlight-last))' }}
                  />
                )}
                {piece && square !== anim?.to && (
                  <img
                    src={`/pieces/cburnett/${piece}.svg`}
                    alt=""
                    className="absolute inset-0 h-full w-full p-[4%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
                    draggable={false}
                  />
                )}
                {square[0] === 'h' && (
                  <span
                    aria-hidden
                    className="absolute right-[3px] top-[2px] font-mono font-semibold leading-none select-none"
                    style={{ fontSize: COORD_FONT_SIZE, color: coordTint(isLight) }}
                  >
                    {square[1]}
                  </span>
                )}
                {square[1] === '1' && (
                  <span
                    aria-hidden
                    className="absolute bottom-[1px] left-[4px] font-mono font-semibold leading-none select-none"
                    style={{ fontSize: COORD_FONT_SIZE, color: coordTint(isLight) }}
                  >
                    {square[0]}
                  </span>
                )}
              </div>
            ))}
          </div>
          {anim && <ReplaySlide key={step} ply={anim} />}
        </div>
      </div>
      <figcaption className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
        Anderssen – Kieseritzky · London 1851 · <span className="text-brass">23.Be7#</span>
      </figcaption>
    </figure>
  );
}

function squareOffset(square: string) {
  return { x: square.charCodeAt(0) - 97, y: 8 - Number(square[1]) };
}

/**
 * Lightweight sibling of the live board's AnimationLayer: the mover slides
 * from → to over 200ms on the product curve, then settles (scale 1.04 → 1);
 * a capture victim holds its square during the slide and dissolves over the
 * final ~90ms as the mover arrives. The 12.5% cell with 0.5%-of-board
 * padding mirrors the 4%-of-square inset the static pieces get.
 */
function ReplaySlide({ ply }: { ply: ReplayPly }) {
  const [arrived, setArrived] = useState(false);
  const [settled, setSettled] = useState(false);
  const [victimFading, setVictimFading] = useState(false);

  useLayoutEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setArrived(true);
        fadeTimer = setTimeout(
          () => setVictimFading(true),
          Math.max(0, MOVE_MS - CAPTURE_FADE_MS),
        );
        settleTimer = setTimeout(() => setSettled(true), MOVE_MS);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  const a = squareOffset(ply.from);
  const b = squareOffset(ply.to);
  const at = arrived ? b : a;
  const scale = arrived && !settled ? 1.04 : 1;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {ply.victim && (
        <div
          className="absolute left-0 top-0 h-[12.5%] w-[12.5%] p-[0.5%]"
          style={{
            transform: `translate(${b.x * 100}%, ${b.y * 100}%)`,
            opacity: victimFading ? 0 : 1,
            transition: victimFading ? `opacity ${CAPTURE_FADE_MS}ms ease-out` : 'none',
          }}
        >
          <ReplayPieceImg piece={ply.victim} />
        </div>
      )}
      <div
        className="absolute left-0 top-0 h-[12.5%] w-[12.5%] p-[0.5%] will-change-transform"
        style={{
          transform: `translate(${at.x * 100}%, ${at.y * 100}%) scale(${scale})`,
          transition: arrived
            ? settled
              ? `transform ${SETTLE_MS}ms ease-out`
              : `transform ${MOVE_MS}ms ${MOVE_EASE}`
            : 'none',
        }}
      >
        <ReplayPieceImg piece={ply.piece} />
      </div>
    </div>
  );
}

function ReplayPieceImg({ piece }: { piece: string }) {
  return (
    <img
      src={`/pieces/cburnett/${piece}.svg`}
      alt=""
      className="h-full w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
      draggable={false}
    />
  );
}
