'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComputerGameStateDto } from '@purechess/shared';
import type { Square } from '@purechess/shared';
import type { MoveIntent } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { getComputerGame, submitComputerMove } from '@/lib/api/computer-games';

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

function parsePgnMoves(pgn: string): string[] {
  if (!pgn.trim()) return [];
  const clean = pgn
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  const tokens = clean.split(/\s+/).filter((t) => t && !/^\d+\./.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  return tokens;
}

interface Props {
  gameId: string;
}

export function ComputerGameClient({ gameId }: Props) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const moveListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getComputerGame(gameId)
      .then((game) => setState({ phase: 'playing', game, submitting: false, moveError: null }))
      .catch((err: Error) => setState({ phase: 'error', message: err.message }));
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
    setState((s: PageState) => s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s);
    try {
      const next = await submitComputerMove(gameId, uci);
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, submitting: false, moveError: (err as Error).message } : s,
      );
    }
  }

  async function handleResign() {
    if (state.phase !== 'playing') return;
    setState((s: PageState) => s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s);
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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading game…</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">Error: {state.message}</p>
      </div>
    );
  }

  const { game, submitting, moveError } = state;
  const orientation = game.computerColor === 'white' ? 'black' : 'white';
  const isGameOver = game.status === 'completed';
  const readOnly = isGameOver || submitting;
  const lastMove = parseLastMove(game.lastComputerMove);
  const sanMoves = parsePgnMoves(game.pgn);
  const resultLabel = getResultLabel(game.result, game.computerColor);
  const reasonLabel = game.resultReason ? (REASON_LABELS[game.resultReason] ?? game.resultReason) : null;

  const movePairs: Array<[string, string | undefined]> = [];
  for (let i = 0; i < sanMoves.length; i += 2) {
    movePairs.push([sanMoves[i]!, sanMoves[i + 1]]);
  }

  return (
    <BoardSettingsProvider>
      <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-screen items-start justify-center">
        <div className="flex flex-col gap-3 w-full max-w-[480px]">
          {isGameOver && (
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold">{resultLabel}</p>
              {reasonLabel && (
                <p className="text-sm text-muted-foreground mt-1">{reasonLabel}</p>
              )}
            </div>
          )}

          <div className="relative">
            <Chessboard
              position={game.fen}
              orientation={orientation}
              onMove={handleMove}
              lastMove={lastMove}
              readOnly={readOnly}
            />
            {submitting && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded">
                <p className="text-sm font-medium">Computer is thinking…</p>
              </div>
            )}
          </div>

          {moveError && (
            <p className="text-sm text-destructive">{moveError}</p>
          )}

          {!isGameOver && (
            <button
              onClick={handleResign}
              disabled={submitting}
              className="w-full rounded-md border border-destructive text-destructive py-2 text-sm font-medium hover:bg-destructive/10 disabled:opacity-50 transition-colors"
            >
              Resign
            </button>
          )}
        </div>

        <div className="w-full lg:w-64 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Moves</h2>
          <div
            ref={moveListRef}
            className="rounded-md border bg-card overflow-y-auto max-h-[480px] text-sm"
          >
            {movePairs.length === 0 ? (
              <p className="p-3 text-muted-foreground">No moves yet.</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {movePairs.map(([white, black], i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-1 text-muted-foreground w-8 select-none">{i + 1}.</td>
                      <td className="px-2 py-1 w-1/2">{white}</td>
                      <td className="px-2 py-1 w-1/2">{black ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </BoardSettingsProvider>
  );
}
