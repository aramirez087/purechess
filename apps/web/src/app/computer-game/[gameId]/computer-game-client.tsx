'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
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
import { computeMaterial } from '@/lib/board/material';
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

interface Props {
  gameId: string;
}

export function ComputerGameClient({ gameId }: Props) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const [flipped, setFlipped] = useState(false);
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
      clock: '∞',
      captured,
      capturedColor,
      advantage,
    };
  }

  return (
    <BoardSettingsProvider>
      <GameShell
        board={
          <BoardColumn
            topPlayer={stripFor(topColor)}
            bottomPlayer={stripFor(bottomColor)}
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
            {isGameOver && (
              <div className="rounded-[6px] border border-[#d6b563]/35 bg-[#d6b563]/10 px-4 py-3 text-center">
                <p className="text-lg font-semibold text-[#f8f1de]">{resultLabel}</p>
                {reasonLabel && <p className="mt-1 text-sm text-[#b9b19d]">{reasonLabel}</p>}
              </div>
            )}
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
              <p className="rounded-[6px] border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {moveError}
              </p>
            )}
            <BoardControlBar onFlip={() => setFlipped((f) => !f)}>
              {!isGameOver && (
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
