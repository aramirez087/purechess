'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import type { ComputerGameStateDto } from '@purechess/shared';
import type { Square } from '@purechess/shared';
import type { MoveIntent } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { getComputerGame, submitComputerMove } from '@/lib/api/computer-games';
import { cn } from '@/lib/utils';

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

function getResultLabel(result: string | null, computerColor: 'white' | 'black'): string {
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

function formatColor(color: 'white' | 'black'): string {
  return color === 'white' ? 'White' : 'Black';
}

function getHumanColor(computerColor: 'white' | 'black'): 'white' | 'black' {
  return computerColor === 'white' ? 'black' : 'white';
}

function getSideToMove(fen: string): 'white' | 'black' {
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

interface PlayerStripProps {
  name: string;
  detail: string;
  active: boolean;
  status?: string;
}

function PlayerStrip({ name, detail, active, status }: PlayerStripProps) {
  return (
    <div
      className={cn(
        'flex min-h-12 items-center justify-between gap-3 rounded-[6px] border px-3 py-2 transition-colors',
        active
          ? 'border-[#d6b563]/45 bg-[#d6b563]/10 text-[#f8f1de]'
          : 'border-[#2b332c] bg-[#121511] text-[#f1eee6]',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{name}</p>
        <p className="mt-0.5 text-xs leading-tight text-[#9da79c]">{detail}</p>
      </div>
      {status && (
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#2b332c] bg-[#0b0d0b]/70 px-2.5 py-1 text-[11px] font-medium text-[#d8d2c3]">
          <span
            aria-hidden="true"
            className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-[#d6b563]' : 'bg-[#4b554b]')}
          />
          {status}
        </div>
      )}
    </div>
  );
}

export function ComputerGameClient({ gameId }: Props) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const moveListRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [state]);

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
  const orientation = game.computerColor === 'white' ? 'black' : 'white';
  const humanColor = getHumanColor(game.computerColor);
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

  const movePairs: Array<[string, string | undefined]> = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    movePairs.push([sanMoves[i]!, sanMoves[i + 1]]);
  }

  return (
    <BoardSettingsProvider>
      <main id="main-content" className="min-h-screen overflow-hidden bg-[#0b0d0b] text-[#f1eee6]">
        <div className="mx-auto grid min-h-screen w-full max-w-[1180px] grid-cols-1 gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,720px)_320px] lg:items-start lg:gap-7 lg:px-8">
          <section className="flex min-w-0 flex-col gap-3">
            {isGameOver && (
              <div className="rounded-[6px] border border-[#d6b563]/35 bg-[#d6b563]/10 px-4 py-3 text-center">
                <p className="text-lg font-semibold text-[#f8f1de]">{resultLabel}</p>
                {reasonLabel && <p className="mt-1 text-sm text-[#b9b19d]">{reasonLabel}</p>}
              </div>
            )}

            <PlayerStrip
              name="Computer"
              detail={`Level ${game.computerLevel} | ${formatColor(game.computerColor)}`}
              active={computerActive}
              status={computerActive ? statusLabel : undefined}
            />

            <div className="relative rounded-[6px] border border-[#2b332c] bg-[#121511] p-2 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-3">
              <Chessboard
                position={game.fen}
                orientation={orientation}
                onMove={handleMove}
                lastMove={lastMove}
                readOnly={readOnly}
                className="max-w-none [&_[role=grid]]:overflow-hidden [&_[role=grid]]:rounded-[3px] [&_[role=grid]]:shadow-[inset_0_0_0_1px_rgba(11,13,11,0.28)]"
              />
              {submitting && (
                <div className="absolute inset-2 flex items-center justify-center rounded-[3px] bg-[#0b0d0b]/55 backdrop-blur-[1px] sm:inset-3">
                  <div
                    aria-live="polite"
                    className="flex items-center gap-3 rounded-full border border-[#d6b563]/35 bg-[#0b0d0b]/85 px-4 py-2 text-sm font-medium text-[#f8f1de] shadow-[0_16px_50px_rgba(0,0,0,0.35)]"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-[#d6b563]" aria-hidden="true" />
                    Computer is thinking
                  </div>
                </div>
              )}
            </div>

            <PlayerStrip
              name="You"
              detail={`${formatColor(humanColor)} pieces`}
              active={humanActive}
              status={humanActive ? statusLabel : undefined}
            />

            {moveError && (
              <p className="rounded-[6px] border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {moveError}
              </p>
            )}

            {!isGameOver && (
              <button
                onClick={handleResign}
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-destructive/45 bg-transparent px-4 text-sm font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                Resign
              </button>
            )}
          </section>

          <aside className="w-full lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[6px] border border-[#2b332c] bg-[#121511] shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between border-b border-[#2b332c] px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9da79c]">
                  Moves
                </h2>
                <span className="font-mono text-xs tabular-nums text-[#6f7a70]">
                  {sanMoves.length} ply
                </span>
              </div>
              <div
                ref={moveListRef}
                className="max-h-[42vh] overflow-y-auto text-sm lg:max-h-[calc(100vh-8rem)]"
              >
                {movePairs.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-[#7f897f]">No moves yet.</p>
                ) : (
                  <table className="w-full border-separate border-spacing-0">
                    <tbody>
                      {movePairs.map(([white, black], i) => (
                        <tr
                          key={i}
                          className={cn(
                            'group border-b border-[#232a24] text-[#d8d2c3] transition-colors hover:bg-[#181c17]',
                            i === movePairs.length - 1 && 'bg-[#d6b563]/[0.06] text-[#f1eee6]',
                          )}
                        >
                          <td className="w-12 border-b border-[#232a24] px-4 py-2 font-mono text-xs tabular-nums text-[#6f7a70] group-last:border-b-0">
                            {i + 1}
                          </td>
                          <td className="w-1/2 border-b border-[#232a24] px-2 py-2 font-mono text-[13px] tabular-nums group-last:border-b-0">
                            {white}
                          </td>
                          <td className="w-1/2 border-b border-[#232a24] px-2 py-2 pr-4 font-mono text-[13px] tabular-nums group-last:border-b-0">
                            {black ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </BoardSettingsProvider>
  );
}
