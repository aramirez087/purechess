'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flag, Loader2, Plus, User } from 'lucide-react';
import type { PvpGameStateDto, Square } from '@purechess/shared';
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
import { ResultOverlay, type ResultTone } from '@/components/game/result-overlay';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { PgnIconActions } from '@/components/review/pgn-actions';
import { computeMaterial } from '@/lib/board/material';
import { cn } from '@/lib/utils';
import { getPvpGame, submitPvpMove, resignPvpGame } from '@/lib/api/pvp-games';
import { useGameKeyboard } from '@/hooks/use-game-keyboard';
import { useLiveClock, formatClock } from '@/hooks/use-live-clock';

type Color = 'white' | 'black';

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'playing'; game: PvpGameStateDto; submitting: boolean; moveError: string | null };

const POLL_MS = 1500;

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

function getSideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function parseLastMove(uci: string | null): { from: Square; to: Square } | undefined {
  if (!uci || uci.length < 4) return undefined;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
}

function parsePgnMoves(pgn: string): string[] {
  if (!pgn.trim()) return [];
  const clean = pgn
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .trim();
  return clean
    .split(/\s+/)
    .filter((t) => t && !/^\d+\./.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

function getResultLabel(result: string | null, yourColor: Color): string {
  if (!result) return '';
  if (result === 'draw') return 'Draw';
  const youWin =
    (result === 'white_wins' && yourColor === 'white') ||
    (result === 'black_wins' && yourColor === 'black');
  return youWin ? 'You won' : 'You lost';
}

function StatusHero({
  isGameOver,
  tone,
  resultLabel,
  reasonLabel,
  yourTurn,
  opponentName,
  timed,
}: {
  isGameOver: boolean;
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  yourTurn: boolean;
  opponentName: string;
  timed: boolean;
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
        <p className="font-display mt-1.5 text-[26px] italic leading-tight text-[#f8f1de]">
          {resultLabel}
        </p>
        {reasonLabel && (
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#b9b19d]">
            by {reasonLabel}
          </p>
        )}
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
              yourTurn
                ? 'bg-[#84c98a] shadow-[0_0_10px_2px_rgba(132,201,138,0.45)]'
                : 'animate-pulse bg-[#d6b563] shadow-[0_0_10px_2px_rgba(214,181,99,0.6)]',
            )}
          />
          <p className="truncate text-base font-semibold tracking-tight text-[#f4efe2]">
            {yourTurn ? 'Your move' : `Waiting for ${opponentName}`}
          </p>
        </div>
        {!yourTurn && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#d6b563]" aria-hidden="true" />
        )}
      </div>
      <p className="mt-1.5 text-xs text-[#9da79c]">
        Friend game · {timed ? 'Timed' : 'Untimed'}
      </p>
    </div>
  );
}

interface Props {
  gameId: string;
}

export function LiveGameClient({ gameId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const [flipped, setFlipped] = useState(false);
  const [currentPly, setCurrentPly] = useState(0);
  const [resultDismissed, setResultDismissed] = useState(false);
  const disposedRef = useRef(false);

  const _isPlaying = state.phase === 'playing';
  const _isGameOver = _isPlaying && state.game.status === 'completed';
  const _sanCount = _isPlaying ? parsePgnMoves(state.game.pgn).length : 0;

  useEffect(() => {
    setCurrentPly(_sanCount);
  }, [_sanCount]);

  useGameKeyboard({
    isGameOver: _isGameOver,
    isComputerThinking: false,
    currentPly,
    totalPly: _sanCount,
    onHint: undefined,
    onTakeback: undefined,
    onResign: _isGameOver ? undefined : handleResign,
    onFlip: () => setFlipped((f) => !f),
    onNew: _isGameOver ? () => router.push('/play') : undefined,
    onSeek: setCurrentPly,
  });

  const liveClock = useLiveClock(
    _isPlaying ? state.game.clock : null,
    _isPlaying ? getSideToMove(state.game.fen) : 'white',
    _isPlaying && state.game.status === 'active',
  );

  // Initial load.
  useEffect(() => {
    disposedRef.current = false;
    getPvpGame(gameId)
      .then((game) => {
        if (disposedRef.current) return;
        setState({ phase: 'playing', game, submitting: false, moveError: null });
      })
      .catch((err: Error) => setState({ phase: 'error', message: err.message }));
    return () => {
      disposedRef.current = true;
    };
  }, [gameId]);

  // Poll while the game is live: opponent moves, resignations and server-side
  // flag falls all arrive through here. The board animates the diff.
  const statusForPoll = _isPlaying ? state.game.status : null;
  useEffect(() => {
    if (statusForPoll !== 'active' && statusForPoll !== 'invite_pending') return;
    const id = setInterval(async () => {
      try {
        const next = await getPvpGame(gameId);
        if (disposedRef.current) return;
        setState((s) =>
          s.phase === 'playing' && !s.submitting
            ? { ...s, game: next }
            : s,
        );
      } catch {
        // transient poll error — keep the last good state
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [gameId, statusForPoll]);

  async function handleMove(intent: MoveIntent) {
    if (state.phase !== 'playing') return;
    if (!intent.from || !intent.to) return;
    const uci = intent.from + intent.to + (intent.promotion ?? '');
    setState((s) => (s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s));
    try {
      const next = await submitPvpMove(gameId, uci);
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s) =>
        s.phase === 'playing'
          ? { ...s, submitting: false, moveError: (err as Error).message }
          : s,
      );
    }
  }

  async function handleResign() {
    if (state.phase !== 'playing') return;
    setState((s) => (s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s));
    try {
      const next = await resignPvpGame(gameId);
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s) =>
        s.phase === 'playing'
          ? { ...s, submitting: false, moveError: (err as Error).message }
          : s,
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
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0d0b] px-4 text-[#f1eee6]"
      >
        <div className="max-w-md rounded-[6px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error: {state.message}
        </div>
        <Link href="/play" className="text-sm text-[#9da79c] underline-offset-4 hover:underline">
          Back to play
        </Link>
      </main>
    );
  }

  const { game, submitting, moveError } = state;
  const sanMoves = parsePgnMoves(game.pgn);
  const yourColor = game.yourColor;
  const orientation: Color = flipped ? (yourColor === 'white' ? 'black' : 'white') : yourColor;
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove = getSideToMove(game.fen);
  const isGameOver = game.status === 'completed';
  const yourTurn = !isGameOver && sideToMove === yourColor;
  // Not gated on turn: the board's own premove flow handles out-of-turn input
  // and the server rejects anything illegal.
  const readOnly = isGameOver || submitting;
  const lastMove = parseLastMove(game.lastMove);
  const resultLabel = getResultLabel(game.result, yourColor);
  const reasonLabel = game.resultReason
    ? (REASON_LABELS[game.resultReason] ?? game.resultReason)
    : null;
  const resultTone: ResultTone =
    resultLabel === 'You won' ? 'win' : resultLabel === 'Draw' ? 'draw' : 'loss';
  const material = computeMaterial(game.fen);
  const opponent = yourColor === 'white' ? game.black : game.white;
  const opponentName = opponent?.username ?? 'Opponent';
  const flaggedColor: Color | null =
    isGameOver && game.resultReason === 'timeout'
      ? game.result === 'white_wins'
        ? 'black'
        : game.result === 'black_wins'
          ? 'white'
          : null
      : null;

  function stripFor(color: Color): PlayerStripProps {
    const isYou = color === yourColor;
    const player = color === 'white' ? game.white : game.black;
    const active = !isGameOver && sideToMove === color;
    const captured = color === 'white' ? material.byWhite : material.byBlack;
    const capturedColor = color === 'white' ? 'b' : 'w';
    const advantage = color === 'white' ? material.advantage : -material.advantage;
    return {
      name: isYou ? 'You' : (player?.username ?? 'Opponent'),
      detail: `${color === 'white' ? 'White' : 'Black'} pieces`,
      active,
      status: active ? (isYou ? 'Your move' : 'Thinking') : undefined,
      avatar: <User className="h-5 w-5" aria-hidden="true" />,
      clock: liveClock
        ? color === flaggedColor
          ? formatClock(0)
          : formatClock(color === 'white' ? liveClock.whiteMs : liveClock.blackMs)
        : undefined,
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
              yourTurn={yourTurn}
              opponentName={opponentName}
              timed={game.clock != null}
            />

            <GameRail
              title="Moves"
              aside={
                <span className="flex items-center gap-2.5">
                  {`${sanMoves.length} ply`}
                  <PgnIconActions pgn={game.pgn} fen={game.fen} gameId={gameId} />
                </span>
              }
              className="min-h-0 flex-1"
              bodyClassName="flex-1"
            >
              <MovePanel
                moves={sanMoves.map((san, i) => ({ san, ply: i + 1 }))}
                currentPly={currentPly}
                onSeek={setCurrentPly}
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
