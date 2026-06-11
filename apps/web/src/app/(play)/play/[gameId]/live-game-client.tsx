'use client';

import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flag, Loader2, Plus } from 'lucide-react';
import type { PvpGameStateDto, Square, WsGameStatePayload } from '@purechess/shared';
import type { MoveIntent } from '@purechess/shared';
import { Chessboard } from '@/components/board/chessboard';
import { BoardSettingsProvider } from '@/components/board/board-context';
import {
  GameShell,
  BoardColumn,
  GameRail,
  MovePanel,
  BoardControlBar,
  GameErrorState,
  MoveErrorNotice,
  type PlayerStripProps,
} from '@/components/game';
import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';
import { ResultOverlay, type ResultTone } from '@/components/game/result-overlay';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { PgnIconActions } from '@/components/review/pgn-actions';
import { getPieceSvg } from '@/lib/board/piece-svgs';
import { computeMaterial } from '@/lib/board/material';
import { cn } from '@/lib/utils';
import { getPvpGame, submitPvpMove, resignPvpGame } from '@/lib/api/pvp-games';
import { useGameKeyboard } from '@/hooks/use-game-keyboard';
import { useGameSocket } from '@/hooks/use-game-socket';
import { useLiveClock, formatClock } from '@/hooks/use-live-clock';

type Color = 'white' | 'black';

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'playing'; game: PvpGameStateDto; submitting: boolean; moveError: string | null };

// Polling is the fallback transport: fast cadence when the socket is down,
// slow safety-net heartbeat when live pushes are flowing.
const POLL_MS = 1500;
const SLOW_POLL_MS = 10_000;

/** Merge a color-neutral WS push into the REST-fetched game state. */
function mergeWsState(game: PvpGameStateDto, p: WsGameStatePayload): PvpGameStateDto {
  return {
    ...game,
    fen: p.fen,
    pgn: p.pgn,
    status: p.status,
    lastMove: p.lastMove,
    ply: p.ply,
    result: p.result,
    resultReason: p.resultReason,
    clock: p.clock,
  };
}

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

/**
 * Slim status zone docked inside the unified rail (not a floating card).
 * Owns the turn state + game settings line; the player strips stay quiet.
 */
function StatusHero({
  isGameOver,
  tone,
  resultLabel,
  reasonLabel,
  yourTurn,
  opponentName,
  timed,
  rated,
  opponentOffline,
}: {
  isGameOver: boolean;
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  yourTurn: boolean;
  opponentName: string;
  timed: boolean;
  rated?: boolean;
  opponentOffline?: boolean;
}) {
  if (isGameOver) {
    const toneClasses: Record<ResultTone, string> = {
      win: 'bg-gradient-to-b from-[#d6b563]/[0.14] to-transparent',
      draw: 'bg-gradient-to-b from-[#1b201a] to-transparent',
      loss: 'bg-gradient-to-b from-destructive/[0.12] to-transparent',
    };
    return (
      <div className={cn('px-4 py-3.5 text-center', toneClasses[tone])}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9da79c]">
          Game over
        </p>
        <p className="font-display mt-1 text-[22px] italic leading-tight text-[#f8f1de]">
          {resultLabel}
        </p>
        {reasonLabel && (
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-[#b9b19d]">
            by {reasonLabel}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              'h-2 w-2 shrink-0 rounded-full bg-[#d6b563]',
              yourTurn
                ? 'shadow-[0_0_8px_1px_rgba(214,181,99,0.45)]'
                : 'animate-pulse shadow-[0_0_10px_2px_rgba(214,181,99,0.6)]',
            )}
          />
          <p
            aria-live="polite"
            className="truncate text-sm font-semibold tracking-tight text-[#f4efe2]"
          >
            {yourTurn ? 'Your move' : `Waiting for ${opponentName}`}
          </p>
        </div>
        {!yourTurn && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#d6b563]" aria-hidden="true" />
        )}
      </div>
      <p className="mt-1 text-xs text-[#9da79c]">
        Friend game · {timed ? 'Timed' : 'Untimed'}
        {rated ? ' · Rated' : ''}
        {opponentOffline && (
          <span className="text-[#b9b19d]"> · {opponentName} disconnected</span>
        )}
      </p>
    </div>
  );
}

/** Score-sheet result chip for a finished game, from this side's perspective. */
function resultChipFor(result: string | null, color: Color): string | undefined {
  if (!result) return undefined;
  if (result === 'draw') return '½';
  return (result === 'white_wins') === (color === 'white') ? '1' : '0';
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
  // Bumped by the error screen's "Try again" to re-run the initial load.
  const [loadToken, setLoadToken] = useState(0);
  const disposedRef = useRef(false);

  const _isPlaying = state.phase === 'playing';
  const _isGameOver = _isPlaying && state.game.status === 'completed';
  const _sanCount = _isPlaying ? parsePgnMoves(state.game.pgn).length : 0;
  const statusLive = _isPlaying ? state.game.status : null;
  const liveEnabled = statusLive === 'active' || statusLive === 'invite_pending';

  useEffect(() => {
    setCurrentPly(_sanCount);
  }, [_sanCount]);

  // Live push channel. Server emits authoritative state on every persisted
  // change; REST stays the source of truth for initial load and reconnects.
  const socket = useGameSocket(gameId, liveEnabled, {
    onState: (p) =>
      setState((s) => {
        if (s.phase !== 'playing' || s.submitting) return s;
        // Drop stale pushes (an older ply with no status change).
        if (p.ply < s.game.ply && p.status === s.game.status) return s;
        return { ...s, game: mergeWsState(s.game, p) };
      }),
    onResync: () => {
      getPvpGame(gameId)
        .then((game) => {
          if (disposedRef.current) return;
          setState((s) => (s.phase === 'playing' && !s.submitting ? { ...s, game } : s));
        })
        .catch(() => {
          // transient — fallback polling covers it
        });
    },
  });

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
    socket.clockOffsetMs,
  );

  // When the side to move flags locally, ask the server once: getState runs
  // detectResult, finalizes the timeout and pushes game:over to both players.
  const flagPending =
    _isPlaying &&
    state.game.status === 'active' &&
    liveClock != null &&
    (liveClock.whiteMs <= 0 || liveClock.blackMs <= 0);
  const flagClaimedRef = useRef(false);
  useEffect(() => {
    if (!flagPending) {
      flagClaimedRef.current = false;
      return;
    }
    if (flagClaimedRef.current) return;
    flagClaimedRef.current = true;
    getPvpGame(gameId)
      .then((game) => {
        if (disposedRef.current) return;
        setState((s) => (s.phase === 'playing' && !s.submitting ? { ...s, game } : s));
      })
      .catch(() => {
        flagClaimedRef.current = false;
      });
  }, [flagPending, gameId]);

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
  }, [gameId, loadToken]);

  function handleRetry() {
    setState({ phase: 'loading' });
    setLoadToken((t) => t + 1);
  }

  // Fallback polling: fast when the socket is down (sole transport), slow
  // safety-net heartbeat when pushes are flowing. The board animates the diff.
  const pollMs = socket.connected ? SLOW_POLL_MS : POLL_MS;
  useEffect(() => {
    if (!liveEnabled) return;
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
    }, pollMs);
    return () => clearInterval(id);
  }, [gameId, liveEnabled, pollMs]);

  async function handleMove(intent: MoveIntent) {
    if (state.phase !== 'playing') return;
    if (!intent.from || !intent.to) return;
    const uci = intent.from + intent.to + (intent.promotion ?? '');
    const before = state.game;

    // Optimistic render: the piece lands instantly; the server response (or
    // an error rollback) reconciles afterwards.
    let optimisticFen: string | null = null;
    try {
      const c = new Chess(before.fen);
      const m = c.move({ from: intent.from, to: intent.to, promotion: intent.promotion });
      if (m) optimisticFen = c.fen();
    } catch {
      // illegal locally — let the server be the judge
    }

    setState((s) =>
      s.phase === 'playing'
        ? {
            ...s,
            game: optimisticFen
              ? { ...s.game, fen: optimisticFen, lastMove: uci }
              : s.game,
            submitting: true,
            moveError: null,
          }
        : s,
    );
    try {
      const next = await submitPvpMove(gameId, uci);
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s) =>
        s.phase === 'playing'
          ? { ...s, game: before, submitting: false, moveError: (err as Error).message }
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
    // Same silhouette as the route-level loading.tsx so the board geometry
    // stays stable from route load through the state fetch.
    return <GameLoadingSkeleton />;
  }

  if (state.phase === 'error') {
    return <GameErrorState message={state.message} onRetry={handleRetry} />;
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
  const opponentOffline =
    !isGameOver &&
    socket.connected &&
    socket.presentUserIds !== null &&
    opponent?.id != null &&
    !socket.presentUserIds.includes(opponent.id);
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
    const KingGlyph = getPieceSvg('k', color === 'white' ? 'w' : 'b');
    return {
      name: isYou ? 'You' : (player?.username ?? 'Opponent'),
      // The hero owns turn state copy; strips just say which army.
      detail: `${color === 'white' ? 'White' : 'Black'} pieces`,
      side: color,
      active,
      status: !isYou && active ? 'Thinking' : undefined,
      resultChip: isGameOver ? resultChipFor(game.result, color) : undefined,
      avatar: (
        <KingGlyph
          className={cn(
            'h-6 w-6',
            color === 'black' && 'drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]',
          )}
        />
      ),
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
          <GameRail
            title="Moves"
            aside={
              <span className="flex items-center gap-2.5">
                {`${sanMoves.length} ply`}
                <PgnIconActions pgn={game.pgn} fen={game.fen} gameId={gameId} />
              </span>
            }
            className="h-full min-h-0"
            bodyClassName="relative min-h-0 flex-1"
            header={
              <>
                <div className="flex min-h-[3.25rem] items-center justify-between border-b border-[#2b332c] px-3">
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
                  rated={game.rated}
                  opponentOffline={opponentOffline}
                />
              </>
            }
            footer={
              <BoardControlBar onFlip={() => setFlipped((f) => !f)} className="p-2">
                {isGameOver ? (
                  <Link
                    href="/play"
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#d6b563]/45 bg-[#d6b563]/10 px-3 text-sm font-semibold text-[#f3e7c4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 active:translate-y-px active:bg-[#d6b563]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    New game
                  </Link>
                ) : (
                  <button
                    onClick={handleResign}
                    disabled={submitting}
                    className="group inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] focus-visible:border-destructive/60 focus-visible:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Flag
                      className="h-4 w-4 text-destructive/70 transition-colors group-hover:text-destructive group-focus-visible:text-destructive"
                      aria-hidden="true"
                    />
                    Resign
                  </button>
                )}
              </BoardControlBar>
            }
          >
            <MovePanel
              moves={sanMoves.map((san, i) => ({ san, ply: i + 1 }))}
              currentPly={currentPly}
              onSeek={setCurrentPly}
            />
            <MoveErrorNotice message={moveError} className="absolute inset-x-2.5 bottom-2.5 z-10" />
          </GameRail>
        }
      />
    </BoardSettingsProvider>
  );
}
