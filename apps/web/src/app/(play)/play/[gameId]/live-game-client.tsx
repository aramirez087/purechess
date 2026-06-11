'use client';

import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Flag, Handshake, Loader2, Plus, Repeat2 } from 'lucide-react';
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
import {
  getPvpGame,
  submitPvpMove,
  resignPvpGame,
  drawPvpGame,
  abortPvpGame,
  rematchPvpGame,
} from '@/lib/api/pvp-games';
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

/**
 * True when `next` would take the UI backwards relative to `cur`: an older
 * snapshot (REST response raced by a WS push) or a finished game regressing
 * to active. Applied to EVERY server-state merge — WS, poll, resync — so no
 * transport can rewind the board.
 */
function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'aborted';
}

function isStaleState(
  cur: PvpGameStateDto,
  next: Pick<PvpGameStateDto, 'ply' | 'status'>,
): boolean {
  if (isTerminal(cur.status) && !isTerminal(next.status)) return true;
  if (next.ply < cur.ply && next.status === cur.status) return true;
  return false;
}

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
    drawOfferedBy: p.drawOfferedBy ?? null,
    rematch: p.rematch ?? null,
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
  presenceNote,
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
  /** SR-only presence transition text ('… disconnected' / '… reconnected'). */
  presenceNote?: string;
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
        Live game · {timed ? 'Timed' : 'Untimed'}
        {rated ? ' · Rated' : ''}
        {opponentOffline && (
          <span className="text-[#b9b19d]"> · {opponentName} disconnected</span>
        )}
      </p>
      {/* The visible note sits in static text (presence flapping must not
          spam the turn announcement); this mirror announces transitions. */}
      <span aria-live="polite" className="sr-only">
        {presenceNote}
      </span>
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
  /** Server-fetched state: the board SSRs instead of waiting for a client fetch. */
  initialGame?: PvpGameStateDto | null;
}

export function LiveGameClient({ gameId, initialGame = null }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PageState>(() =>
    initialGame
      ? { phase: 'playing', game: initialGame, submitting: false, moveError: null }
      : { phase: 'loading' },
  );
  const [flipped, setFlipped] = useState(false);
  const [currentPly, setCurrentPly] = useState(0);
  const [resultDismissed, setResultDismissed] = useState(false);
  // Bumped by the error screen's "Try again" to re-run the initial load.
  const [loadToken, setLoadToken] = useState(0);
  const disposedRef = useRef(false);

  const _isPlaying = state.phase === 'playing';
  const _isGameOver = _isPlaying && isTerminal(state.game.status);
  const _sanCount = _isPlaying ? parsePgnMoves(state.game.pgn).length : 0;
  const statusLive = _isPlaying ? state.game.status : null;
  // The socket (and slow heartbeat) stay up on finished games so rematch
  // offers/accepts pushed to the room still land without a reload.
  const liveEnabled = statusLive !== null;
  const _ply = _isPlaying ? state.game.ply : 0;
  const _canAbort = _isPlaying && state.game.status === 'active' && _ply < 2;

  useEffect(() => {
    setCurrentPly(_sanCount);
  }, [_sanCount]);

  // A push that arrives while our own move POST is in flight is dropped to
  // protect the optimistic render — this flag schedules a refetch as soon as
  // the POST settles, so a resignation/flag-fall pushed in that window (the
  // POST itself will 400 on the completed game) is never lost.
  const pendingResyncRef = useRef(false);

  /** Guarded REST refetch — every merge goes through isStaleState. */
  function refetchState() {
    getPvpGame(gameId)
      .then((next) => {
        if (disposedRef.current) return;
        setState((s) => {
          if (s.phase !== 'playing' || s.submitting) return s;
          if (isStaleState(s.game, next)) return s;
          return { ...s, game: next };
        });
      })
      .catch(() => {
        // transient — fallback polling covers it
      });
  }

  // Live push channel. Server emits authoritative state on every persisted
  // change; REST stays the source of truth for initial load and reconnects.
  const socket = useGameSocket(gameId, liveEnabled, {
    onState: (p) =>
      setState((s) => {
        if (s.phase !== 'playing') return s;
        if (s.submitting) {
          pendingResyncRef.current = true;
          return s;
        }
        if (isStaleState(s.game, p)) return s;
        return { ...s, game: mergeWsState(s.game, p) };
      }),
    onResync: refetchState,
  });

  // Recover pushes dropped during the submitting window.
  const _submitting = state.phase === 'playing' && state.submitting;
  useEffect(() => {
    if (_submitting || !pendingResyncRef.current) return;
    pendingResyncRef.current = false;
    refetchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_submitting]);

  // Opponent presence, debounced: a page reload or transient blip should not
  // flash 'disconnected' through the meta line.
  const _opponentId = _isPlaying
    ? ((state.game.yourColor === 'white' ? state.game.black?.id : state.game.white?.id) ?? null)
    : null;
  const opponentOfflineRaw =
    _isPlaying &&
    state.game.status === 'active' &&
    socket.connected &&
    socket.presentUserIds !== null &&
    _opponentId != null &&
    !socket.presentUserIds.includes(_opponentId);
  const [opponentOffline, setOpponentOffline] = useState(false);
  const [presenceNote, setPresenceNote] = useState('');
  useEffect(() => {
    if (!opponentOfflineRaw) {
      setOpponentOffline(false);
      return;
    }
    const id = setTimeout(() => setOpponentOffline(true), 2500);
    return () => clearTimeout(id);
  }, [opponentOfflineRaw]);
  useEffect(() => {
    if (opponentOffline) setPresenceNote('Opponent disconnected');
    else setPresenceNote((p) => (p ? 'Opponent reconnected' : ''));
  }, [opponentOffline]);

  // Draw-offer / rematch transitions, mirrored to one polite sr-only note so
  // SR users hear offers arrive/resolve without the visuals.
  const _yourColor = _isPlaying ? state.game.yourColor : null;
  const _drawOfferedBy = _isPlaying ? (state.game.drawOfferedBy ?? null) : null;
  const _rematch = _isPlaying ? (state.game.rematch ?? null) : null;
  const [actionNote, setActionNote] = useState('');
  const prevDrawRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevDrawRef.current;
    prevDrawRef.current = _drawOfferedBy;
    if (_drawOfferedBy && _drawOfferedBy !== _yourColor) {
      setActionNote('Opponent offers a draw');
    } else if (!_drawOfferedBy && prev && prev === _yourColor) {
      setActionNote('Draw offer declined');
    }
  }, [_drawOfferedBy, _yourColor]);

  // Navigate both players into the rematch on the pending→accepted
  // transition only; a page loaded already-accepted shows a Join button
  // instead of yanking the user away on mount.
  const prevRematchRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevRematchRef.current;
    const cur = _rematch?.status ?? null;
    prevRematchRef.current = cur;
    if (_rematch && cur === 'accepted' && prev === 'pending') {
      router.push(`/play/${_rematch.gameId}`);
      return;
    }
    if (_rematch && cur === 'pending' && prev !== 'pending' && _rematch.offeredBy !== _yourColor) {
      setActionNote('Opponent offers a rematch');
    } else if (!_rematch && prev === 'pending') {
      setActionNote('Rematch declined');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rematch?.status, _rematch?.gameId, _yourColor]);

  useGameKeyboard({
    isGameOver: _isGameOver,
    isComputerThinking: false,
    currentPly,
    totalPly: _sanCount,
    onHint: undefined,
    onTakeback: undefined,
    onResign: _isGameOver ? undefined : _canAbort ? handleAbort : handleResign,
    onDraw: _isGameOver || _canAbort ? undefined : handleDrawPrimary,
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
      .then((next) => {
        if (disposedRef.current) return;
        setState((s) => {
          if (s.phase !== 'playing' || s.submitting) return s;
          if (isStaleState(s.game, next)) return s;
          return { ...s, game: next };
        });
      })
      .catch(() => {
        flagClaimedRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagPending, gameId]);

  // Initial load. SSR'd state skips the client fetch entirely; retries
  // (loadToken > 0) always re-fetch.
  useEffect(() => {
    disposedRef.current = false;
    if (initialGame && loadToken === 0) {
      return () => {
        disposedRef.current = true;
      };
    }
    getPvpGame(gameId)
      .then((game) => {
        if (disposedRef.current) return;
        setState({ phase: 'playing', game, submitting: false, moveError: null });
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

  // Fallback polling: fast when the socket is down (sole transport), slow
  // safety-net heartbeat when pushes are flowing. The board animates the diff.
  // Finished games only need the heartbeat cadence (rematch linkage changes).
  const pollMs = socket.connected || _isGameOver ? SLOW_POLL_MS : POLL_MS;
  useEffect(() => {
    if (!liveEnabled) return;
    const id = setInterval(async () => {
      try {
        const next = await getPvpGame(gameId);
        if (disposedRef.current) return;
        setState((s) => {
          if (s.phase !== 'playing' || s.submitting) return s;
          // A poll fetched before a WS push can resolve after it — never let
          // the older snapshot rewind the board or un-finish the game.
          if (isStaleState(s.game, next)) return s;
          return { ...s, game: next };
        });
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
      // The rejection may mean the game ended while our move was in flight
      // (resign/flag-fall pushed during the submitting window) — the rollback
      // state is then stale 'active'. Ask the server once; the guarded merge
      // applies a completed result and ignores anything older.
      refetchState();
    }
  }

  /**
   * Shared template for non-move POST actions: optimistic-free — block merges
   * while in flight, replace state from the response, refetch on error (the
   * rejection may mean the game changed under us).
   */
  async function runAction(post: () => Promise<PvpGameStateDto>) {
    if (state.phase !== 'playing') return;
    setState((s) => (s.phase === 'playing' ? { ...s, submitting: true, moveError: null } : s));
    try {
      const next = await post();
      setState({ phase: 'playing', game: next, submitting: false, moveError: null });
    } catch (err) {
      setState((s) =>
        s.phase === 'playing'
          ? { ...s, submitting: false, moveError: (err as Error).message }
          : s,
      );
      refetchState();
    }
  }

  async function handleResign() {
    await runAction(() => resignPvpGame(gameId));
  }

  async function handleAbort() {
    await runAction(() => abortPvpGame(gameId));
  }

  async function handleDraw(action: 'offer' | 'accept' | 'decline') {
    await runAction(() => drawPvpGame(gameId, action));
  }

  /** Keyboard/primary draw action: accept an incoming offer, else offer. */
  function handleDrawPrimary() {
    if (state.phase !== 'playing' || state.submitting) return;
    const offeredBy = state.game.drawOfferedBy ?? null;
    if (offeredBy === state.game.yourColor) return; // already offered — wait
    void handleDraw(offeredBy ? 'accept' : 'offer');
  }

  /** Offer, accept, or join the rematch depending on the linkage state. */
  function handleRematch() {
    if (state.phase !== 'playing' || state.submitting) return;
    const r = state.game.rematch ?? null;
    if (r?.status === 'accepted') {
      router.push(`/play/${r.gameId}`);
      return;
    }
    if (r?.status === 'pending' && r.offeredBy === state.game.yourColor) return;
    void runAction(() =>
      rematchPvpGame(gameId, r?.status === 'pending' ? 'accept' : 'offer'),
    );
  }

  function handleRematchDecline() {
    if (state.phase !== 'playing' || state.submitting) return;
    void runAction(() => rematchPvpGame(gameId, 'decline'));
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
  const isAborted = game.status === 'aborted';
  const isGameOver = isTerminal(game.status);
  const yourTurn = !isGameOver && sideToMove === yourColor;
  // Not gated on turn: the board's own premove flow handles out-of-turn input
  // and the server rejects anything illegal.
  const readOnly = isGameOver || submitting;
  const lastMove = parseLastMove(game.lastMove);
  const resultLabel = isAborted ? 'Aborted' : getResultLabel(game.result, yourColor);
  const reasonLabel =
    !isAborted && game.resultReason
      ? (REASON_LABELS[game.resultReason] ?? game.resultReason)
      : null;
  const resultTone: ResultTone =
    resultLabel === 'You won' ? 'win' : resultLabel === 'You lost' ? 'loss' : 'draw';
  const drawOfferedBy = game.drawOfferedBy ?? null;
  const incomingDrawOffer = !isGameOver && drawOfferedBy != null && drawOfferedBy !== yourColor;
  const yourDrawOfferPending = !isGameOver && drawOfferedBy === yourColor;
  const rematch = game.rematch ?? null;
  const rematchIncoming = rematch?.status === 'pending' && rematch.offeredBy !== yourColor;
  const rematchMinePending = rematch?.status === 'pending' && rematch.offeredBy === yourColor;
  const rematchAccepted = rematch?.status === 'accepted';
  const rematchLabel = rematchAccepted
    ? 'Join rematch'
    : rematchIncoming
      ? 'Accept rematch'
      : rematchMinePending
        ? 'Rematch offered'
        : 'Rematch';
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
                  onRematch={rematchMinePending ? undefined : handleRematch}
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
                  presenceNote={presenceNote}
                />
                {/* Draw/rematch transitions for SR users (visuals live in the
                    banner + footer); separate from the turn announcement. */}
                <span aria-live="polite" className="sr-only">
                  {actionNote}
                </span>
                {incomingDrawOffer && (
                  <div className="border-t border-[#2b332c] bg-[#d6b563]/[0.07] px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-[#f4efe2]">
                      <Handshake className="h-4 w-4 text-[#d6b563]" aria-hidden="true" />
                      {opponentName} offers a draw
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => handleDraw('accept')}
                        disabled={submitting}
                        className="inline-flex h-8 flex-1 items-center justify-center rounded-[7px] border border-[#d6b563]/45 bg-[#d6b563]/10 px-3 text-xs font-semibold text-[#f3e7c4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Accept draw
                      </button>
                      <button
                        onClick={() => handleDraw('decline')}
                        disabled={submitting}
                        className="inline-flex h-8 flex-1 items-center justify-center rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-xs font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:bg-[#0b0d0b]/60 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </>
            }
            footer={
              <BoardControlBar onFlip={() => setFlipped((f) => !f)} className="p-2">
                {isGameOver ? (
                  <>
                    <button
                      onClick={() => {
                        if (rematchMinePending || submitting) return;
                        handleRematch();
                      }}
                      aria-disabled={rematchMinePending || submitting}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:bg-[#0b0d0b]/60 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                    >
                      <Repeat2 className="h-4 w-4 text-[#d6b563]/80" aria-hidden="true" />
                      {rematchLabel}
                    </button>
                    {rematchIncoming ? (
                      <button
                        onClick={handleRematchDecline}
                        disabled={submitting}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:bg-[#0b0d0b]/60 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Decline
                      </button>
                    ) : (
                      <Link
                        href="/play"
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#d6b563]/45 bg-[#d6b563]/10 px-3 text-sm font-semibold text-[#f3e7c4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 active:translate-y-px active:bg-[#d6b563]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        New game
                      </Link>
                    )}
                  </>
                ) : _canAbort ? (
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
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (yourDrawOfferPending || submitting) return;
                        handleDrawPrimary();
                      }}
                      aria-disabled={yourDrawOfferPending || submitting}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:bg-[#0b0d0b]/60 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                    >
                      <Handshake className="h-4 w-4 text-[#d6b563]/80" aria-hidden="true" />
                      {yourDrawOfferPending ? 'Draw offered' : 'Draw'}
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
