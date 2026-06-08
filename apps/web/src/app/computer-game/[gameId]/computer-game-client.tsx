'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Flag, Loader2, Plus, User } from 'lucide-react';
import type { ComputerGameStateDto } from '@purechess/shared';
import type { Square } from '@purechess/shared';
import type { MoveIntent } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import {
  GameShell,
  BoardColumn,
  GameRail,
  MovePanel,
  BoardControlBar,
  type PlayerStripProps,
} from '@/components/game';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { computeMaterial } from '@/lib/board/material';
import { cn } from '@/lib/utils';
import { getComputerGame, submitComputerMove } from '@/lib/api/computer-games';

type Color = 'white' | 'black';

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'playing'; game: ComputerGameStateDto; submitting: boolean; moveError: string | null };

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Checkmate',
  resignation: 'Resignation',
  timeout: 'Timeout',
  stalemate: 'Stalemate',
  insufficient_material: 'Insufficient material',
  threefold_repetition: 'Threefold repetition',
  fifty_move_rule: 'Fifty-move rule',
  draw_agreement: 'Draw agreement',
  abandonment: 'Abandonment',
};

function getResultLabel(result: string | null, computerColor: Color): string {
  if (!result) return '';
  if (result === 'draw') return 'Draw';
  const computerWins =
    (result === 'white_wins' && computerColor === 'white') ||
    (result === 'black_wins' && computerColor === 'black');
  return computerWins ? 'You lost' : 'You won';
}

function parseLastMove(uci: string | null): { from: Square; to: Square } | undefined {
  if (!uci || uci.length < 4) return undefined;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
}

function formatColor(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

function getHumanColor(computerColor: Color): Color {
  return computerColor === 'white' ? 'black' : 'white';
}

function getSideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

/** Whether it's the computer's turn to move in the given state. */
function isComputerTurn(game: ComputerGameStateDto): boolean {
  if (game.status !== 'active') return false;
  const sideToMove = game.fen.split(' ')[1];
  return sideToMove === (game.computerColor === 'white' ? 'w' : 'b');
}

function parsePgnMoves(pgn: string): string[] {
  if (!pgn.trim()) return [];
  const clean = pgn
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  const tokens = clean
    .split(/\s+/)
    .filter((t) => t && !/^\d+\./.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  return tokens;
}

type ResultTone = 'win' | 'loss' | 'draw';

function StatusHero({
  isGameOver,
  tone,
  resultLabel,
  reasonLabel,
  computerActive,
  level,
}: {
  isGameOver: boolean;
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  computerActive: boolean;
  level: number;
}) {
  if (isGameOver) {
    const toneClasses: Record<ResultTone, string> = {
      win: 'border-[#d6b563]/40 bg-gradient-to-b from-[#d6b563]/[0.18] to-[#d6b563]/[0.03] shadow-[0_0_44px_-14px_rgba(214,181,99,0.55)]',
      draw: 'border-[#586059]/50 bg-gradient-to-b from-[#1b201a] to-[#11140f]',
      loss: 'border-destructive/35 bg-gradient-to-b from-destructive/[0.14] to-destructive/[0.03]',
    };
    return (
      <div className={cn('shrink-0 rounded-[12px] border px-5 py-4 text-center', toneClasses[tone])}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9da79c]">
          Game over
        </p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[#f8f1de]">{resultLabel}</p>
        {reasonLabel && <p className="mt-0.5 text-sm text-[#b9b19d]">{reasonLabel}</p>}
      </div>
    );
  }
  return (
    <div className="shrink-0 rounded-[12px] border border-[#2b332c] bg-gradient-to-b from-[#14180f] to-[#101410] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              computerActive
                ? 'animate-pulse bg-[#d6b563] shadow-[0_0_10px_2px_rgba(214,181,99,0.6)]'
                : 'bg-[#84c98a] shadow-[0_0_10px_2px_rgba(132,201,138,0.45)]',
            )}
          />
          <p className="truncate text-base font-semibold tracking-tight text-[#f4efe2]">
            {computerActive ? 'Computer is thinking' : 'Your move'}
          </p>
        </div>
        {computerActive && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#d6b563]" aria-hidden="true" />
        )}
      </div>
      <p className="mt-1.5 text-xs text-[#9da79c]">Level {level} · Untimed</p>
    </div>
  );
}

function ResultOverlay({
  tone,
  resultLabel,
  reasonLabel,
  onDismiss,
}: {
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  onDismiss: () => void;
}) {
  const toneRing: Record<ResultTone, string> = {
    win: 'border-[#d6b563]/45 shadow-[0_28px_80px_-22px_rgba(214,181,99,0.55)]',
    draw: 'border-[#586059]/55 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.7)]',
    loss: 'border-destructive/40 shadow-[0_28px_80px_-26px_rgba(0,0,0,0.7)]',
  };
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[10px] bg-[#0b0d0b]/55 p-4 backdrop-blur-[3px]">
      <div
        className={cn(
          'animate-rise w-full max-w-[290px] rounded-[16px] border bg-gradient-to-b from-[#1a1e15] to-[#0e110c] px-6 py-6 text-center',
          toneRing[tone],
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#9da79c]">
          Game over
        </p>
        <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[#f8f1de]">
          {resultLabel}
        </p>
        {reasonLabel && <p className="mt-2 text-sm text-[#b9b19d]">by {reasonLabel}</p>}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center justify-center rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3.5 text-sm font-medium text-[#c7cfc4] transition-colors hover:border-[#3a443b] hover:text-[#f1eee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
          >
            View board
          </button>
          <Link
            href="/play"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[7px] border border-[#d6b563]/45 bg-[#d6b563]/12 px-3.5 text-sm font-semibold text-[#f3e7c4] transition-colors hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New game
          </Link>
        </div>
      </div>
    </div>
  );
}

interface Props {
  gameId: string;
}

export function ComputerGameClient({ gameId }: Props) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const [flipped, setFlipped] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  // Guards against React Strict-Mode double-invoking the bot driver, which
  // would submit the same engine move twice.
  const botLockRef = useRef(false);
  const disposedRef = useRef(false);

  // Computes the engine's reply locally (Web Worker) and submits it. Runs
  // inside the async chain (not a state effect) so it fires exactly once per
  // turn. Loops to cover resume-while-it's-the-bot's-turn.
  async function driveBot(startGame: ComputerGameStateDto) {
    if (botLockRef.current) return;
    botLockRef.current = true;
    try {
      const { getBestMove } = await import('@/lib/engine/stockfish-client');
      let current = startGame;
      while (isComputerTurn(current) && !disposedRef.current) {
        const uci = await getBestMove(current.fen, current.computerLevel);
        current = await submitComputerMove(gameId, uci);
        if (disposedRef.current) return;
        setState({ phase: 'playing', game: current, submitting: false, moveError: null });
      }
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, submitting: false, moveError: (err as Error).message } : s,
      );
    } finally {
      botLockRef.current = false;
    }
  }

  useEffect(() => {
    disposedRef.current = false;
    getComputerGame(gameId)
      .then((game) => {
        if (disposedRef.current) return;
        setState({ phase: 'playing', game, submitting: isComputerTurn(game), moveError: null });
        if (isComputerTurn(game)) void driveBot(game);
      })
      .catch((err: Error) => setState({ phase: 'error', message: err.message }));
    return () => {
      disposedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  async function handleMove(intent: MoveIntent) {
    if (state.phase !== 'playing') return;
    if (!intent.from || !intent.to) return;
    const uci = intent.from + intent.to + (intent.promotion ?? '');
    setState((s: PageState) =>
      s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s,
    );
    try {
      const afterUser = await submitComputerMove(gameId, uci);
      setState({
        phase: 'playing',
        game: afterUser,
        submitting: isComputerTurn(afterUser),
        moveError: null,
      });
      if (isComputerTurn(afterUser)) await driveBot(afterUser);
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, submitting: false, moveError: (err as Error).message } : s,
      );
    }
  }

  async function handleResign() {
    if (state.phase !== 'playing') return;
    setState((s: PageState) =>
      s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s,
    );
    try {
      const next = await submitComputerMove(gameId, 'resign');
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, submitting: false, moveError: (err as Error).message } : s,
      );
    }
  }

  if (state.phase === 'loading') {
    return (
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center bg-[#0b0d0b] px-4 text-[#f1eee6]"
      >
        <div className="flex items-center gap-3 rounded-[6px] border border-[#2b332c] bg-[#121511] px-4 py-3 text-sm text-[#c7cfc4]">
          <Loader2 className="h-4 w-4 animate-spin text-[#d6b563]" aria-hidden="true" />
          Loading game
        </div>
      </main>
    );
  }

  if (state.phase === 'error') {
    return (
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center bg-[#0b0d0b] px-4 text-[#f1eee6]"
      >
        <div className="max-w-md rounded-[6px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error: {state.message}
        </div>
      </main>
    );
  }

  const { game, submitting, moveError } = state;
  const humanColor = getHumanColor(game.computerColor);
  const orientation: Color = flipped ? (humanColor === 'white' ? 'black' : 'white') : humanColor;
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove = getSideToMove(game.fen);
  const isGameOver = game.status === 'completed';
  const readOnly = isGameOver || submitting;
  const lastMove = parseLastMove(game.lastComputerMove);
  const sanMoves = parsePgnMoves(game.pgn);
  const resultLabel = getResultLabel(game.result, game.computerColor);
  const reasonLabel = game.resultReason
    ? (REASON_LABELS[game.resultReason] ?? game.resultReason)
    : null;
  const resultTone: ResultTone =
    resultLabel === 'You won' ? 'win' : resultLabel === 'Draw' ? 'draw' : 'loss';
  const computerActive = !isGameOver && (submitting || sideToMove === game.computerColor);
  const humanActive = !isGameOver && !submitting && sideToMove === humanColor;
  const statusLabel = isGameOver ? resultLabel : computerActive ? 'Thinking' : 'Your move';
  const material = computeMaterial(game.fen);

  function stripFor(color: Color): PlayerStripProps {
    const isHuman = color === humanColor;
    const active = isHuman ? humanActive : computerActive;
    const captured = color === 'white' ? material.byWhite : material.byBlack;
    const capturedColor = color === 'white' ? 'b' : 'w';
    const advantage = color === 'white' ? material.advantage : -material.advantage;
    return {
      name: isHuman ? 'You' : 'Computer',
      detail: isHuman ? `${formatColor(humanColor)} pieces` : `Level ${game.computerLevel}`,
      active,
      status: active ? statusLabel : undefined,
      avatar: isHuman ? (
        <User className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Bot className="h-5 w-5" aria-hidden="true" />
      ),
      captured,
      capturedColor,
      advantage,
    };
  }

  return (
    <BoardSettingsProvider>
      <GameShell
        topBar={null}
        className="[--board-reserve:10.5rem]"
        board={
          <BoardColumn
            topPlayer={stripFor(topColor)}
            bottomPlayer={stripFor(bottomColor)}
            overlay={
              isGameOver && !resultDismissed ? (
                <ResultOverlay
                  tone={resultTone}
                  resultLabel={resultLabel}
                  reasonLabel={reasonLabel}
                  onDismiss={() => setResultDismissed(true)}
                />
              ) : undefined
            }
          >
            <Chessboard
              position={game.fen}
              orientation={orientation}
              onMove={handleMove}
              lastMove={lastMove}
              readOnly={readOnly}
              className="[&_[role=grid]]:overflow-hidden [&_[role=grid]]:rounded-[3px] [&_[role=grid]]:shadow-[inset_0_0_0_1px_rgba(11,13,11,0.28)]"
            />
          </BoardColumn>
        }
        rightRail={
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex shrink-0 items-center justify-between">
              <Link
                href="/"
                aria-label="PureChess home"
                className="rounded-[6px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
              >
                <Logo className="text-lg text-[#f1eee6]" />
              </Link>
              <SettingsDialog />
            </div>

            <StatusHero
              isGameOver={isGameOver}
              tone={resultTone}
              resultLabel={resultLabel}
              reasonLabel={reasonLabel}
              computerActive={computerActive}
              level={game.computerLevel}
            />

            <GameRail
              title="Moves"
              aside={`${sanMoves.length} ply`}
              className="min-h-0 flex-1"
              bodyClassName="flex-1"
            >
              <MovePanel
                moves={sanMoves.map((san, i) => ({ san, ply: i + 1 }))}
                currentPly={sanMoves.length}
              />
            </GameRail>

            {moveError && (
              <p className="shrink-0 rounded-[8px] border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {moveError}
              </p>
            )}

            <BoardControlBar onFlip={() => setFlipped((f) => !f)}>
              {isGameOver ? (
                <Link
                  href="/play"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[5px] border border-[#d6b563]/45 bg-[#d6b563]/10 px-3 text-sm font-semibold text-[#f3e7c4] transition-colors hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New game
                </Link>
              ) : (
                <button
                  onClick={handleResign}
                  disabled={submitting}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[5px] border border-destructive/45 bg-transparent px-3 text-sm font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Flag className="h-4 w-4" aria-hidden="true" />
                  Resign
                </button>
              )}
            </BoardControlBar>
          </div>
        }
      />
    </BoardSettingsProvider>
  );
}
