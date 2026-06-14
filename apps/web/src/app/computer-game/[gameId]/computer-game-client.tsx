'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Flag, Handshake, Lightbulb, Loader2, Plus, RotateCcw } from 'lucide-react';
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
  GameOverBanner,
  GameRailBrandHeader,
  type PlayerStripProps,
} from '@/components/game';
import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';
import { getPieceSvg } from '@/lib/board/piece-svgs';
import { computeMaterial } from '@/lib/board/material';
import { loadRules } from '@/lib/board/rules-lazy';
import { cn } from '@/lib/utils';
import {
  getComputerGame,
  submitComputerMove,
  takebackComputerMove,
  rematchComputerGame,
  abortComputerGame,
  drawComputerGame,
} from '@/lib/api/computer-games';
import { PgnIconActions } from '@/components/review/pgn-actions';
import { EvalBar } from '@/components/review/eval-panel';
import { ResultOverlay, type ResultTone } from '@/components/game/result-overlay';
import { bestMoveArrow, type BoardShape } from '@/lib/board/annotations';
import { useGameKeyboard } from '@/hooks/use-game-keyboard';
import { useLiveClock, formatClock } from '@/hooks/use-live-clock';
import { usePositionEval } from '@/hooks/use-position-eval';
import { useLowTimeTick } from '@/hooks/use-low-time-tick';
import { useSettingsStore } from '@/stores/settings-store';
import {
  type Color,
  REASON_LABELS,
  getSideToMove,
  parseLastMove,
  parsePgnMoves,
  getResultLabel,
  resultChipFor,
} from '@/lib/board/game-client-utils';

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'playing'; game: ComputerGameStateDto; submitting: boolean; moveError: string | null };

/** Hints per game — encourages thinking first, asking second. */
const HINT_LIMIT = 3;

function formatColor(color: Color): string {
  return color === 'white' ? 'White' : 'Black';
}

function getHumanColor(computerColor: Color): Color {
  return computerColor === 'white' ? 'black' : 'white';
}

/** Whether it's the computer's turn to move in the given state. */
function isComputerTurn(game: ComputerGameStateDto): boolean {
  if (game.status !== 'active') return false;
  const sideToMove = game.fen.split(' ')[1];
  return sideToMove === (game.computerColor === 'white' ? 'w' : 'b');
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
  if (isGameOver)
    return <GameOverBanner tone={tone} resultLabel={resultLabel} reasonLabel={reasonLabel} />;
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

interface Props {
  gameId: string;
  /** Server-fetched state: the board SSRs instead of waiting for a client fetch. */
  initialGame?: ComputerGameStateDto | null;
}

export function ComputerGameClient({ gameId, initialGame = null }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PageState>(() =>
    initialGame
      ? {
          phase: 'playing',
          game: initialGame,
          submitting: isComputerTurn(initialGame),
          moveError: null,
        }
      : { phase: 'loading' },
  );
  const [flipped, setFlipped] = useState(false);
  // The human's most recent move squares — the DTO only carries
  // `lastComputerMove`, so without this the player's own move is never
  // highlighted (it shows the computer's prior move while the engine thinks).
  const [humanMove, setHumanMove] = useState<{ from: Square; to: Square } | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [hintShape, setHintShape] = useState<BoardShape[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintPending, setHintPending] = useState(false);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by the error screen's "Try again" to re-run the initial load.
  const [loadToken, setLoadToken] = useState(0);
  // Guards against React Strict-Mode double-invoking the bot driver, which
  // would submit the same engine move twice.
  const botLockRef = useRef(false);
  const disposedRef = useRef(false);

  // Safe keyboard opts — work before game loads (function declarations hoisted)
  const _isPlaying = state.phase === 'playing';
  const _isGameOver =
    _isPlaying && (state.game.status === 'completed' || state.game.status === 'aborted');
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
    onHint: _isGameOver ? undefined : handleHint,
    onTakeback: _isGameOver ? undefined : handleTakeback,
    onResign: _isGameOver ? undefined : handleResign,
    onDraw: _isGameOver ? undefined : handleClaimDraw,
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
  const _humanTurnMs: number | null =
    state.phase === 'playing' && liveClock && state.game.status === 'active'
      ? (() => {
          const humanCol = getHumanColor(state.game.computerColor);
          if (getSideToMove(state.game.fen) !== humanCol) return null;
          return humanCol === 'white' ? liveClock.whiteMs : liveClock.blackMs;
        })()
      : null;
  useLowTimeTick(_humanTurnMs, lowTimeSound);

  // Live eval bar (settings-gated). Analyzes only on the human's turn so the
  // engine job queue stays free while the bot computes its reply; a null fen
  // (toggle off / not playing) stops the hook's debounce entirely.
  const showEvalBar = useSettingsStore((s) => s.showEvalBar);
  const humanTurnForEval =
    _isPlaying &&
    state.game.status === 'active' &&
    !state.submitting &&
    getSideToMove(state.game.fen) === getHumanColor(state.game.computerColor);
  const { evaluation, thinking } = usePositionEval(
    showEvalBar && _isPlaying ? state.game.fen : null,
    humanTurnForEval,
    { multiPv: 1 },
  );

  // Tracks the live fen so an in-flight hint can detect the player moved while
  // the engine thought, and a showing hint arrow clears when the position moves
  // on (it no longer applies).
  const liveFen = _isPlaying ? state.game.fen : null;
  const latestFenRef = useRef<string | null>(null);
  useEffect(() => {
    if (latestFenRef.current !== null && liveFen !== latestFenRef.current) {
      setHintShape((s) => (s.length ? [] : s));
    }
    latestFenRef.current = liveFen;
  }, [liveFen]);

  useEffect(
    () => () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    },
    [],
  );

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
    const fen = state.game.fen;
    loadRules()
      // unparseable FEN → null → the resign fallback still ends the game
      .then((r) => submitComputerMove(gameId, r.firstLegalUci(fen) ?? 'resign'))
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

  // Full-strength engine hint (not the level-nerfed getBestMove) — shows the
  // genuinely best move as a 3-second arrow. Limited to HINT_LIMIT per game.
  async function handleHint() {
    if (state.phase !== 'playing') return;
    if (hintsUsed >= HINT_LIMIT || hintPending || hintShape.length > 0) return;
    if (state.submitting || state.game.status !== 'active' || isComputerTurn(state.game)) return;
    const fenAtClick = state.game.fen;
    setHintPending(true);
    try {
      const { analyze } = await import('@/lib/engine/stockfish-client');
      const result = await analyze(fenAtClick, { movetimeMs: 1500, multiPv: 1 });
      // The player may have moved (or the game ended) while the engine thought.
      if (disposedRef.current || latestFenRef.current !== fenAtClick) return;
      const arrow = bestMoveArrow(result.pv?.[0] ?? result.bestmove);
      if (arrow) {
        setHintShape([arrow]);
        setHintsUsed((n) => n + 1);
        hintTimeoutRef.current = setTimeout(() => setHintShape([]), 3000);
      }
    } catch {
      // Engine hiccup — leave the hint unspent.
    } finally {
      setHintPending(false);
    }
  }

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
    // SSR'd state skips the client fetch entirely; the bot still has to be
    // driven from an effect (the server only rendered, never moved). Retries
    // (loadToken > 0) always re-fetch.
    if (initialGame && loadToken === 0) {
      if (isComputerTurn(initialGame)) void driveBot(initialGame);
      return () => {
        disposedRef.current = true;
      };
    }
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

  const handleRetry = (): void => {
    setState({ phase: 'loading' });
    setLoadToken((t) => t + 1);
  };

  async function handleMove(intent: MoveIntent) {
    if (state.phase !== 'playing') return;
    if (!intent.from || !intent.to) return;
    const uci = intent.from + intent.to + (intent.promotion ?? '');
    const before = state.game;

    // Optimistic render: apply the move locally so the piece lands instantly
    // instead of waiting a network round trip; the server response (or an
    // error rollback) reconciles afterwards. The rules module is lazy but
    // warm here (the board loads it on mount); null = illegal locally, let
    // the server be the judge.
    const rules = await loadRules();
    const optimisticFen: string | null = rules.applyMoveToFen(before.fen, intent);

    setHumanMove({ from: intent.from, to: intent.to });
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

  // Abort: only before the human has moved (server-enforced); no result,
  // no rating impact — mirrors the PvP ply<2 abort.
  async function handleAbort() {
    if (state.phase !== 'playing') return;
    setState((s: PageState) =>
      s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s,
    );
    try {
      const next = await abortComputerGame(gameId);
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s: PageState) =>
        s.phase === 'playing' ? { ...s, submitting: false, moveError: (err as Error).message } : s,
      );
    }
  }

  // The computer never answers offers — vs the bot, "draw" means claiming a
  // genuine, server-detected draw (threefold / fifty-move / insufficient
  // material). An unfounded claim 400s and surfaces as a move error.
  async function handleClaimDraw() {
    if (state.phase !== 'playing' || state.submitting) return;
    setState((s: PageState) =>
      s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s,
    );
    try {
      const next = await drawComputerGame(gameId, 'claim');
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
    setState((s: PageState) => (s.phase === 'playing' ? { ...s, moveError: null } : s));
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
  const humanColor = getHumanColor(game.computerColor);
  const orientation: Color = flipped ? (humanColor === 'white' ? 'black' : 'white') : humanColor;
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove = getSideToMove(game.fen);
  const isAborted = game.status === 'aborted';
  const isGameOver = game.status === 'completed' || isAborted;
  const readOnly = isGameOver || submitting;
  // Highlight whichever side moved last: when it's the computer's turn the
  // human just moved (engine still thinking, or human delivered mate), so show
  // the human's move; otherwise the computer's reply is the most recent.
  const humanJustPlayed = sideToMove === game.computerColor;
  const lastMove =
    humanJustPlayed && humanMove ? humanMove : parseLastMove(game.lastComputerMove);
  const resultLabel = isAborted ? 'Aborted' : getResultLabel(game.result, humanColor);
  const reasonLabel =
    !isAborted && game.resultReason
      ? (REASON_LABELS[game.resultReason] ?? game.resultReason)
      : null;
  const resultTone: ResultTone =
    resultLabel === 'You won' ? 'win' : resultLabel === 'You lost' ? 'loss' : 'draw';
  const computerActive = !isGameOver && (submitting || sideToMove === game.computerColor);
  const humanActive = !isGameOver && !submitting && sideToMove === humanColor;
  // Abort window: the human hasn't moved yet (server rule). Who moved first
  // follows from move-count parity against the side to move — robust for
  // from-fen games where black may start.
  const firstMover: Color =
    sanMoves.length % 2 === 0 ? sideToMove : sideToMove === 'white' ? 'black' : 'white';
  const humanHasMoved =
    firstMover === humanColor ? sanMoves.length >= 1 : sanMoves.length >= 2;
  const canAbort = !isGameOver && !humanHasMoved;
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

  const hintsLeft = HINT_LIMIT - hintsUsed;
  // Shared between the abort-window and mid-game control bars — hints are
  // available from move one.
  const hintButton = (
    <button
      onClick={handleHint}
      disabled={hintsLeft <= 0 || !humanActive || hintPending || hintShape.length > 0}
      title="Show the engine's best move"
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Lightbulb className="h-4 w-4 text-[#d6b563]/80" aria-hidden="true" />
      {hintsLeft <= 0 ? 'No hints left' : hintsUsed > 0 ? `Hint (${hintsLeft} left)` : 'Hint'}
    </button>
  );

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
      timeMs: liveClock
        ? color === flaggedColor
          ? 0
          : color === 'white'
            ? liveClock.whiteMs
            : liveClock.blackMs
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
                  analyzeHref={`/games/${gameId}`}
                />
              ) : undefined
            }
            evalBar={
              showEvalBar ? (
                <EvalBar evaluation={evaluation} orientation={orientation} thinking={thinking} />
              ) : undefined
            }
          >
            <Chessboard
              position={game.fen}
              orientation={orientation}
              onMove={handleMove}
              lastMove={lastMove}
              readOnly={readOnly}
              autoShapes={hintShape}
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
                <GameRailBrandHeader />
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
                ) : canAbort ? (
                  <>
                    {hintButton}
                    <button
                      onClick={handleAbort}
                      disabled={submitting}
                      className="group inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] focus-visible:border-destructive/60 focus-visible:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Ban
                        className="h-4 w-4 text-destructive/70 transition-colors group-hover:text-destructive group-focus-visible:text-destructive"
                        aria-hidden="true"
                      />
                      Abort
                    </button>
                  </>
                ) : (
                  <>
                    {hintButton}
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
                      onClick={handleClaimDraw}
                      disabled={submitting}
                      title="Claim a draw (threefold repetition or fifty-move rule)"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:bg-[#0b0d0b]/60 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Handshake className="h-4 w-4 text-[#d6b563]/80" aria-hidden="true" />
                      Draw
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
