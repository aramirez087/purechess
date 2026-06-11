'use client';

import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flag, Loader2, Plus, RotateCcw } from 'lucide-react';
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
  GameErrorState,
  MoveErrorNotice,
  type PlayerStripProps,
} from '@/components/game';
import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';
import { Logo } from '@/components/layout/Logo';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { getPieceSvg } from '@/lib/board/piece-svgs';
import { computeMaterial } from '@/lib/board/material';
import { cn } from '@/lib/utils';
import {
  getComputerGame,
  submitComputerMove,
  takebackComputerMove,
  rematchComputerGame,
} from '@/lib/api/computer-games';
import { PgnIconActions } from '@/components/review/pgn-actions';
import { ResultOverlay, type ResultTone } from '@/components/game/result-overlay';
import { LiveAnnouncer } from '@/components/computer-game/live-announcer';
import { useGameKeyboard } from '@/hooks/use-game-keyboard';
import { useLiveClock, formatClock } from '@/hooks/use-live-clock';
import { useSettingsStore } from '@/stores/settings-store';
import { soundEngine } from '@/lib/board/sound';

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


/**
 * Slim status zone docked inside the unified rail (not a floating card).
 * Owns the turn state + game settings line; the player strips stay quiet.
 */
function StatusHero({
  isGameOver,
  tone,
  resultLabel,
  reasonLabel,
  computerActive,
  level,
  timed,
}: {
  isGameOver: boolean;
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  computerActive: boolean;
  level: number;
  timed: boolean;
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
              computerActive
                ? 'animate-pulse shadow-[0_0_10px_2px_rgba(214,181,99,0.6)]'
                : 'shadow-[0_0_8px_1px_rgba(214,181,99,0.45)]',
            )}
          />
          <p
            aria-live="polite"
            className="truncate text-sm font-semibold tracking-tight text-[#f4efe2]"
          >
            {computerActive ? 'Computer is thinking' : 'Your move'}
          </p>
        </div>
        {computerActive && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#d6b563]" aria-hidden="true" />
        )}
      </div>
      <p className="mt-1 text-xs text-[#9da79c]">
        Level {level} · {timed ? 'Timed' : 'Untimed'}
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

export function ComputerGameClient({ gameId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const [flipped, setFlipped] = useState(false);
  const [currentPly, setCurrentPly] = useState(0);
  const [resultDismissed, setResultDismissed] = useState(false);
  // Bumped by the error screen's "Try again" to re-run the initial load.
  const [loadToken, setLoadToken] = useState(0);
  // Guards against React Strict-Mode double-invoking the bot driver, which
  // would submit the same engine move twice.
  const botLockRef = useRef(false);
  const disposedRef = useRef(false);

  // Safe keyboard opts — work before game loads (function declarations hoisted)
  const _isPlaying = state.phase === 'playing';
  const _isGameOver = _isPlaying && state.game.status === 'completed';
  const _isComputerThinking = _isPlaying ? state.submitting : false;
  const _sanCount = _isPlaying ? parsePgnMoves(state.game.pgn).length : 0;

  // Keep currentPly at the live end after each new move
  useEffect(() => {
    setCurrentPly(_sanCount);
  }, [_sanCount]);

  useGameKeyboard({
    isGameOver: _isGameOver,
    isComputerThinking: _isComputerThinking,
    currentPly,
    totalPly: _sanCount,
    onHint: undefined,
    onTakeback: _isGameOver ? undefined : handleTakeback,
    onResign: _isGameOver ? undefined : handleResign,
    onFlip: () => setFlipped((f) => !f),
    onNew: _isGameOver ? () => router.push('/play') : undefined,
    onSeek: setCurrentPly,
  });

  // Live per-side countdown for timed games; null for untimed (clock omitted
  // from the DTO). Must run before the loading/error early returns.
  const liveClock = useLiveClock(
    _isPlaying ? state.game.clock : null,
    _isPlaying ? getSideToMove(state.game.fen) : 'white',
    _isPlaying && state.game.status === 'active',
  );

  // Low-time tick: one per second while the human's clock runs under 10s.
  const lowTimeSound = useSettingsStore((s) => s.lowTimeSound);
  const lastTickSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (!_isPlaying || !liveClock || state.game.status !== 'active') return;
    const humanIsWhite = getHumanColor(state.game.computerColor) === 'white';
    const humanTurn = getSideToMove(state.game.fen) === (humanIsWhite ? 'white' : 'black');
    const ms = humanIsWhite ? liveClock.whiteMs : liveClock.blackMs;
    if (!humanTurn || ms <= 0 || ms >= 10_000) {
      lastTickSecondRef.current = null;
      return;
    }
    const sec = Math.ceil(ms / 1000);
    if (lastTickSecondRef.current !== sec) {
      lastTickSecondRef.current = sec;
      soundEngine.playTick(lowTimeSound);
    }
  }, [_isPlaying, liveClock, state, lowTimeSound]);

  // When the side to move hits 0:00 client-side, the server only learns about
  // the flag on the next submit — so claim it: any move attempt on a flagged
  // clock resolves to a completed/timeout state (engine checks time before
  // validating the move).
  const flagClaimedRef = useRef(false);
  useEffect(() => {
    if (!_isPlaying || !liveClock || flagClaimedRef.current) return;
    if (state.game.status !== 'active') return;
    const stm = getSideToMove(state.game.fen);
    const ms = stm === 'white' ? liveClock.whiteMs : liveClock.blackMs;
    if (ms > 0) return;
    flagClaimedRef.current = true;
    let uci = 'resign';
    try {
      const m = new Chess(state.game.fen).moves({ verbose: true })[0];
      if (m) uci = m.from + m.to + (m.promotion ?? '');
    } catch {
      // unparseable FEN — resign fallback still ends the game
    }
    submitComputerMove(gameId, uci)
      .then((next) => {
        if (!disposedRef.current) {
          setState({ phase: 'playing', game: next, submitting: false, moveError: null });
        }
      })
      .catch(() => {
        flagClaimedRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_isPlaying, liveClock, state, gameId]);

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
  }, [gameId, loadToken]);

  function handleRetry() {
    setState({ phase: 'loading' });
    setLoadToken((t) => t + 1);
  }

  async function handleMove(intent: MoveIntent) {
    if (state.phase !== 'playing') return;
    if (!intent.from || !intent.to) return;
    const uci = intent.from + intent.to + (intent.promotion ?? '');
    const before = state.game;

    // Optimistic render: apply the move locally so the piece lands instantly
    // instead of waiting a network round trip; the server response (or an
    // error rollback) reconciles afterwards.
    let optimisticFen: string | null = null;
    try {
      const c = new Chess(before.fen);
      const m = c.move({ from: intent.from, to: intent.to, promotion: intent.promotion });
      if (m) optimisticFen = c.fen();
    } catch {
      // illegal locally — let the server be the judge
    }

    setState((s: PageState) =>
      s.phase === 'playing'
        ? {
            ...s,
            game: optimisticFen ? { ...s.game, fen: optimisticFen } : s.game,
            submitting: true,
            moveError: null,
          }
        : s,
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
        s.phase === 'playing'
          ? { ...s, game: before, submitting: false, moveError: (err as Error).message }
          : s,
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

  // Undo the last full move (your move + the computer's reply).
  async function handleTakeback() {
    if (state.phase !== 'playing') return;
    setState((s: PageState) =>
      s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s,
    );
    try {
      const next = await takebackComputerMove(gameId, 2);
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, submitting: false, moveError: (err as Error).message } : s,
      );
    }
  }

  // Same opponent and settings, colours swapped — navigates to the new game.
  async function handleRematch() {
    if (state.phase !== 'playing') return;
    setState((s: PageState) =>
      s.phase === 'playing' ? { ...s, moveError: null } : s,
    );
    try {
      const next = await rematchComputerGame(gameId, true);
      router.push(`/computer-game/${next.gameId}`);
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, moveError: (err as Error).message } : s,
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
  const lastComputerMoveSan: string | null = (() => {
    if (!game.lastComputerMove || sanMoves.length === 0) return null;
    const sideToMove = game.fen.split(' ')[1];
    const computerJustPlayed = sideToMove !== (game.computerColor === 'white' ? 'w' : 'b');
    return computerJustPlayed ? (sanMoves[sanMoves.length - 1] ?? null) : null;
  })();
  const humanColor = getHumanColor(game.computerColor);
  const orientation: Color = flipped ? (humanColor === 'white' ? 'black' : 'white') : humanColor;
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove = getSideToMove(game.fen);
  const isGameOver = game.status === 'completed';
  const readOnly = isGameOver || submitting;
  const lastMove = parseLastMove(game.lastComputerMove);
  const resultLabel = getResultLabel(game.result, game.computerColor);
  const reasonLabel = game.resultReason
    ? (REASON_LABELS[game.resultReason] ?? game.resultReason)
    : null;
  const resultTone: ResultTone =
    resultLabel === 'You won' ? 'win' : resultLabel === 'Draw' ? 'draw' : 'loss';
  const computerActive = !isGameOver && (submitting || sideToMove === game.computerColor);
  const humanActive = !isGameOver && !submitting && sideToMove === humanColor;
  const material = computeMaterial(game.fen);
  // On a timeout the engine's flag-fall path returns the clock un-ticked, so
  // the loser's stored value is stale — display the flagged side at zero.
  const flaggedColor: Color | null =
    isGameOver && game.resultReason === 'timeout'
      ? game.result === 'white_wins'
        ? 'black'
        : game.result === 'black_wins'
          ? 'white'
          : null
      : null;

  function stripFor(color: Color): PlayerStripProps {
    const isHuman = color === humanColor;
    const active = isHuman ? humanActive : computerActive;
    const captured = color === 'white' ? material.byWhite : material.byBlack;
    const capturedColor = color === 'white' ? 'b' : 'w';
    const advantage = color === 'white' ? material.advantage : -material.advantage;
    const KingGlyph = getPieceSvg('k', color === 'white' ? 'w' : 'b');
    return {
      name: isHuman ? 'You' : 'Computer',
      // The hero owns turn state + level copy; strips just say which army.
      detail: `${formatColor(color)} pieces`,
      side: color,
      active,
      status: !isHuman && computerActive ? 'Thinking' : undefined,
      resultChip: isGameOver ? resultChipFor(game.result, color) : undefined,
      clock: liveClock
        ? color === flaggedColor
          ? formatClock(0)
          : formatClock(color === 'white' ? liveClock.whiteMs : liveClock.blackMs)
        : undefined,
      avatar: (
        <KingGlyph
          className={cn(
            'h-6 w-6',
            color === 'black' && 'drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]',
          )}
        />
      ),
      captured,
      capturedColor,
      advantage,
    };
  }

  return (
    <BoardSettingsProvider>
      <LiveAnnouncer lastComputerMoveSan={lastComputerMoveSan} gameResult={resultLabel || null} />
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
                  onRematch={handleRematch}
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
                  computerActive={computerActive}
                  level={game.computerLevel}
                  timed={game.clock != null}
                />
              </>
            }
            footer={
              <BoardControlBar onFlip={() => setFlipped((f) => !f)} className="p-2">
                {isGameOver ? (
                  <>
                    <button
                      onClick={handleRematch}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#d6b563]/45 bg-[#d6b563]/10 px-3 text-sm font-semibold text-[#f3e7c4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 active:translate-y-px active:bg-[#d6b563]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Rematch
                    </button>
                    <Link
                      href="/play"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      New game
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleTakeback}
                      disabled={submitting || !humanActive || sanMoves.length < 2}
                      title="Take back your last move"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Takeback
                    </button>
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
                  </>
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
