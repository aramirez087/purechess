'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, FlipVertical2, Swords, User } from 'lucide-react';
import { Chess } from 'chess.js';
import { Chessboard } from '@/components/board';
import { PracticeFromFenDialog } from '@/components/play/practice-from-fen-dialog';
import { BoardSettingsProvider } from '@/components/board/board-context';
import {
  GameShell,
  BoardColumn,
  GameRail,
  GameTopBar,
  GameErrorState,
  MovePanel,
  type PlayerStripProps,
} from '@/components/game';
import { ReviewControls } from '@/components/review/review-controls';
import { EvalBar, EngineLines } from '@/components/review/eval-panel';
import { EvalGraph } from '@/components/review/eval-graph';
import { MoveTimeChart } from '@/components/review/move-time-chart';
import { ClassificationBadge } from '@/components/review/classification-badge';
import { AccuracySummary } from '@/components/review/accuracy-summary';
import { MoveCoach } from '@/components/review/move-coach';
import { PgnActions } from '@/components/review/pgn-actions';
import { MistakeTrainer, type MistakeItem } from '@/components/review/mistake-trainer';
import { ReportButton } from '@/components/reports/report-button';
import { useGameReview } from '@/hooks/use-game-review';
import { useMoveClassifier } from '@/hooks/use-move-classifier';
import { useMistakeCapture, CAPTURE_CP_THRESHOLD } from '@/hooks/use-mistake-capture';
import { useOpeningName } from '@/hooks/use-opening-name';
import { usePositionEval } from '@/hooks/use-position-eval';
import { bestMoveArrow, type BoardShape } from '@/lib/board/annotations';
import { computeMaterial } from '@/lib/board/material';
import { replayToFen } from '@/lib/replay';
import { cn } from '@/lib/utils';
import { GameResult, GameTermination } from '@purechess/shared';
import type { AnalysisReview, ReviewPlayer } from '@/types/game-review';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type Color = 'white' | 'black';

interface ReviewClientProps {
  /** Completed game or pasted analysis — result/termination may be unknown. */
  game: AnalysisReview;
  reportTarget?: { opponentId: string; opponentUsername: string } | null;
  /** Optional left-rail action (e.g. /analyze's "New analysis"). */
  exitAction?: React.ReactNode;
  /**
   * The signed-in viewer's own side, or null when they aren't a player. Drives
   * mistake capture + the "train your mistakes" panel (own-side moves only).
   */
  viewerColor?: 'w' | 'b' | null;
}

export function formatResult(result: GameResult): string {
  switch (result) {
    case GameResult.WhiteWins:
      return '1 – 0';
    case GameResult.BlackWins:
      return '0 – 1';
    case GameResult.Draw:
      return '½ – ½';
  }
}

export function formatTermination(t: GameTermination): string {
  switch (t) {
    case GameTermination.Checkmate:
      return 'Checkmate';
    case GameTermination.Resignation:
      return 'Resignation';
    case GameTermination.Timeout:
      return 'Timeout';
    case GameTermination.Stalemate:
      return 'Stalemate';
    case GameTermination.InsufficientMaterial:
      return 'Insufficient material';
    case GameTermination.ThreefoldRepetition:
      return 'Threefold repetition';
    case GameTermination.FiftyMoveRule:
      return 'Fifty-move rule';
    case GameTermination.DrawAgreement:
      return 'Draw agreement';
    case GameTermination.Abandonment:
      return 'Abandonment';
  }
}

// Computer reviews stash the level in `rating`; a 0 rating means unrated.
function ratingLabel(player: ReviewPlayer): string {
  if (player.id === 'computer') return `Level ${player.rating}`;
  return player.rating > 0 ? String(player.rating) : 'Unrated';
}

/** Per-player score-sheet chip: "1" / "0" / "½" — hidden when the outcome is unknown. */
function chipFor(color: Color, result: GameResult | undefined): string | undefined {
  if (result === undefined) return undefined;
  if (result === GameResult.Draw) return '½';
  return (color === 'white') === (result === GameResult.WhiteWins) ? '1' : '0';
}

/** ACPL readability tint — same thresholds as inaccuracy/mistake. */
function acplColor(acpl: number): string {
  if (acpl < 20) return 'text-green-400';
  if (acpl < 50) return 'text-yellow-400';
  return 'text-red-500';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <dt className="text-xs text-[#9da79c]">{label}</dt>
      <dd className="font-mono text-[13px] font-medium tabular-nums text-[#e7e3d6]">{value}</dd>
    </div>
  );
}

function MatchupRow({
  side,
  name,
  rating,
  winner,
}: {
  side: Color;
  name: string;
  rating: string;
  winner: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        role="img"
        aria-label={side === 'white' ? 'Plays white' : 'Plays black'}
        className={cn(
          'h-2.5 w-2.5 shrink-0 rounded-[2px] ring-1 ring-inset',
          side === 'white' ? 'bg-[#e9e4d4] ring-black/30' : 'bg-[#3d4a40] ring-[#2b332c]',
        )}
      />
      <span
        className={cn(
          'min-w-0 truncate text-sm',
          winner ? 'font-semibold text-[#f1eee6]' : 'font-medium text-[#c7cfc4]',
        )}
      >
        {name}
      </span>
      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-[#8a948a]">
        {rating}
      </span>
    </div>
  );
}

export function ReviewClient({
  game,
  reportTarget,
  exitAction,
  viewerColor = null,
}: ReviewClientProps) {
  const { ply, fen, lastMove, isCorrupt, goTo, goNext, goPrev, goStart, goEnd } =
    useGameReview(game);
  const [flipped, setFlipped] = useState(false);
  // Full-game classification — user-triggered, runs on the same client worker.
  const {
    result: classification,
    progress,
    running: classifying,
    run: runClassifier,
  } = useMoveClassifier(game.moves, game.startFen);
  // Capture the viewer's own blunders into the backlog once analysis finishes —
  // fire-and-forget, idempotent (server upserts). No-op for spectators/analysis.
  useMistakeCapture({
    gameId: game.id,
    moves: game.moves,
    startFen: game.startFen,
    viewerColor,
    classification,
  });
  // This game's own-side mistakes, shaped for the inline trainer. Position
  // BEFORE each blunder is re-derived from the move list; the solution is the
  // engine's best move. Mirrors the server's own-side + threshold gate.
  const mistakeItems = useMemo<MistakeItem[]>(() => {
    if (!viewerColor || !classification) return [];
    const items: MistakeItem[] = [];
    for (const m of classification.moves) {
      if (m.color !== viewerColor) continue;
      if (m.class !== 'mistake' && m.class !== 'blunder') continue;
      if (m.cpl < CAPTURE_CP_THRESHOLD || !m.bestUci) continue;
      const fenBefore = replayToFen(game.moves, m.ply - 1, game.startFen);
      if (!fenBefore) continue;
      items.push({
        ply: m.ply,
        moveNumber: Math.ceil(m.ply / 2),
        color: m.color,
        san: m.san,
        fen: fenBefore,
        bestLineUci: [m.bestUci],
        cpLoss: Math.round(m.cpl),
      });
    }
    return items;
  }, [viewerColor, classification, game.moves, game.startFen]);
  const displayFen = fen ?? STARTING_FEN;
  // Single engine search per position feeds both the eval bar and the readout.
  const { evaluation, thinking, lines } = usePositionEval(displayFen, !isCorrupt, { multiPv: 3 });
  // Opening name for the top-bar center slot — display only, crossfades with
  // the matchup line while the seek position is still in book.
  const opening = useOpeningName(displayFen);
  const [heldOpening, setHeldOpening] = useState<string | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  useEffect(() => {
    if (opening) setHeldOpening(opening);
  }, [opening]);
  // Engine best move as a board arrow; user-drawn shapes live in the board.
  // Hidden while thinking — the held evaluation belongs to the previous
  // position, so its bestmove would draw a wrong arrow on the new one (the
  // eval BAR holding its value is fine; a held arrow is misleading geometry).
  const autoShapes = useMemo<BoardShape[]>(() => {
    const arrow = thinking ? null : bestMoveArrow(evaluation?.bestmove);
    return arrow ? [arrow] : [];
  }, [thinking, evaluation?.bestmove]);

  // The classified move that produced the current position (ply 0 = start).
  const currentMove = ply > 0 ? classification?.moves[ply - 1] : undefined;
  // Engine's better move (SAN) for the coach line, computed from the position
  // BEFORE the current move. Only resolved when the move fell short of best.
  const coachBestSan = useMemo<string | undefined>(() => {
    if (!currentMove?.bestUci) return undefined;
    const before = replayToFen(game.moves, ply - 1, game.startFen);
    if (!before) return undefined;
    try {
      const chess = new Chess(before);
      const uci = currentMove.bestUci;
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      return move?.san;
    } catch {
      return undefined;
    }
  }, [currentMove?.bestUci, ply, game.moves, game.startFen]);
  // Pin the move-quality badge to the square the current move landed on.
  const moveGlyph = useMemo(
    () =>
      lastMove && currentMove
        ? { square: lastMove.to, moveClass: currentMove.class }
        : undefined,
    [lastMove, currentMove],
  );

  if (isCorrupt) {
    return (
      <GameErrorState
        message="The game record appears to be corrupt. If this problem persists, please contact support@purechess.com."
        backHref="/games"
        backLabel="Back to games"
      />
    );
  }

  const orientation: Color = flipped ? 'black' : 'white';
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove: Color = displayFen.split(' ')[1] === 'b' ? 'black' : 'white';
  const material = computeMaterial(displayFen);
  const winner: Color | null =
    game.result === GameResult.WhiteWins
      ? 'white'
      : game.result === GameResult.BlackWins
        ? 'black'
        : null;
  // Pasted analyses may have no honest outcome: no score, no verdict, no chips.
  const resultLabel = game.result !== undefined ? formatResult(game.result) : null;
  const typeLabel = game.result === undefined ? 'Analysis' : game.rated ? 'Rated' : 'Casual';
  // Computer-game reviews carry no start date (startedAt: '') — omit the row.
  const startedAtMs = game.startedAt ? new Date(game.startedAt).getTime() : 0;
  const date =
    startedAtMs > 0
      ? new Date(startedAtMs).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null;

  function stripFor(color: Color): PlayerStripProps {
    const player = color === 'white' ? game.white : game.black;
    const isComputer = player.id === 'computer';
    const captured = color === 'white' ? material.byWhite : material.byBlack;
    const capturedColor = color === 'white' ? 'b' : 'w';
    const advantage = color === 'white' ? material.advantage : -material.advantage;
    return {
      name: player.username,
      detail: `${color === 'white' ? 'White' : 'Black'} · ${ratingLabel(player)}`,
      side: color,
      // The seek cursor reads as a quiet brass bar, not a live-turn glow.
      active: color === sideToMove,
      subtle: true,
      resultChip: chipFor(color, game.result),
      avatar: isComputer ? (
        <Bot className="h-5 w-5" aria-hidden="true" />
      ) : (
        <User className="h-5 w-5" aria-hidden="true" />
      ),
      captured,
      capturedColor,
      advantage,
    };
  }

  return (
    <BoardSettingsProvider>
      <GameShell
        topBar={
          <GameTopBar
            center={
              <span className="grid font-mono text-[11px] uppercase tracking-[0.18em] text-[#9da79c]">
                <span
                  className={cn(
                    'col-start-1 row-start-1 text-center transition-opacity duration-300',
                    opening ? 'opacity-0' : 'opacity-100',
                  )}
                  aria-hidden={Boolean(opening)}
                >
                  {game.white.username} <span className="text-[#8a958a]">vs</span>{' '}
                  {game.black.username} · {resultLabel ? `${resultLabel} · ` : ''}
                  {typeLabel}
                </span>
                <span
                  className={cn(
                    'col-start-1 row-start-1 text-center text-[#d8d2c3] transition-opacity duration-300',
                    opening ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden={!opening}
                >
                  {heldOpening}
                </span>
              </span>
            }
          />
        }
        leftRail={
          <div className="flex flex-col gap-4">
            {/* Printed score card: verdict, score, matchup, particulars, exports. */}
            <GameRail>
              <div className="px-4 pb-4 pt-5">
                <p className="font-display text-[26px] italic leading-[1.1] text-[#f1eee6]">
                  {game.termination !== undefined
                    ? `${formatTermination(game.termination)}.`
                    : 'Analysis.'}
                </p>
                {resultLabel && (
                  <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[#d6b563]">
                    {resultLabel}
                  </p>
                )}
              </div>
              <div
                aria-hidden="true"
                className="mx-4 h-px bg-gradient-to-r from-[#d6b563]/40 to-transparent"
              />
              <div className="flex flex-col gap-2.5 px-4 py-4">
                {(['white', 'black'] as const).map((color) => (
                  <MatchupRow
                    key={color}
                    side={color}
                    name={(color === 'white' ? game.white : game.black).username}
                    rating={ratingLabel(color === 'white' ? game.white : game.black)}
                    winner={winner === color}
                  />
                ))}
              </div>
              <div aria-hidden="true" className="mx-4 h-px bg-[#2b332c]" />
              <dl className="divide-y divide-[#232a24]/70 py-1 text-sm">
                <InfoRow label="Time" value={game.timeControl.label} />
                <InfoRow label="Type" value={typeLabel} />
                {date && <InfoRow label="Date" value={date} />}
              </dl>
              <div className="border-t border-[#2b332c] p-2.5">
                <PgnActions pgn={game.pgn} gameId={game.id} />
              </div>
            </GameRail>
            {exitAction}
            {reportTarget && (
              <ReportButton
                gameId={game.id}
                opponentId={reportTarget.opponentId}
                opponentUsername={reportTarget.opponentUsername}
              />
            )}
          </div>
        }
        board={
          <BoardColumn
            topPlayer={stripFor(topColor)}
            bottomPlayer={stripFor(bottomColor)}
            evalBar={
              <EvalBar evaluation={evaluation} orientation={orientation} thinking={thinking} />
            }
          >
            <Chessboard
              position={displayFen}
              orientation={orientation}
              readOnly
              autoShapes={autoShapes}
              moveGlyph={moveGlyph}
              lastMove={lastMove ?? undefined}
              className="[&_[role=grid]]:overflow-hidden [&_[role=grid]]:rounded-[3px] [&_[role=grid]]:shadow-[inset_0_0_0_1px_rgba(11,13,11,0.28)]"
            />
          </BoardColumn>
        }
        rightRail={
          <GameRail
            title="Moves"
            aside={
              <EngineLines
                fen={displayFen}
                evaluation={evaluation}
                thinking={thinking}
                lines={lines}
              />
            }
            className="min-h-0 flex-1"
            bodyClassName="flex min-h-0 flex-1 flex-col"
          >
            {/* Game analysis: button → progress → eval graph + ACPL summary. */}
            <div className="shrink-0 border-b border-[#2b332c] px-2.5 py-2">
              {!classification && !classifying && (
                <button
                  type="button"
                  onClick={runClassifier}
                  className="inline-flex h-8 w-full items-center justify-center whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-[13px] font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                >
                  Analyze game
                </button>
              )}
              {classifying && (
                <div aria-live="polite">
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-[#9da79c]">
                    <span>Analyzing…</span>
                    <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#2b332c]">
                    <div
                      className="h-full rounded-full bg-[#d6b563] transition-[width] duration-300"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {classification && (
                <EvalGraph
                  evals={classification.evals}
                  currentPly={ply}
                  onSeek={goTo}
                  className="rounded-[4px]"
                />
              )}
              {/* Self-hides when the game has no real thinking time. */}
              <MoveTimeChart
                moves={game.moves}
                classifications={classification?.moves}
                currentPly={ply}
                onSeek={goTo}
                className="mt-1.5"
              />
              {classification && (
                <div className="mt-2 flex flex-col gap-2">
                  <AccuracySummary result={classification} />
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-[#8a948a]">
                    <span>
                      W ACPL{' '}
                      <span className={acplColor(classification.whiteAcpl)}>
                        {Math.round(classification.whiteAcpl)}
                      </span>
                    </span>
                    <span>
                      B ACPL{' '}
                      <span className={acplColor(classification.blackAcpl)}>
                        {Math.round(classification.blackAcpl)}
                      </span>
                    </span>
                  </div>
                  <MoveCoach move={currentMove} bestSan={coachBestSan} />
                  {mistakeItems.length > 0 && (
                    <MistakeTrainer gameId={game.id} mistakes={mistakeItems} />
                  )}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <MovePanel
                moves={game.moves.map((m, i) => ({
                  san: m.san,
                  ply: i + 1,
                  badge: <ClassificationBadge class={classification?.moves[i]?.class} />,
                }))}
                currentPly={ply}
                onSeek={goTo}
              />
            </div>
            {/* Seek controls dock inside the moves sheet — one continuous panel. */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2b332c] p-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  aria-label="Flip board"
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                >
                  <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
                  Flip
                </button>
                <button
                  type="button"
                  onClick={() => setPracticeOpen(true)}
                  title="Practice from this position"
                  aria-label="Practice from this position"
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                >
                  <Swords className="h-4 w-4" aria-hidden="true" />
                  Practice
                </button>
              </div>
              <ReviewControls
                onStart={goStart}
                onPrev={goPrev}
                onNext={goNext}
                onEnd={goEnd}
                atStart={ply === 0}
                atEnd={ply === game.moves.length}
              />
            </div>
          </GameRail>
        }
      />
      {practiceOpen && (
        <PracticeFromFenDialog
          fen={displayFen}
          open
          onClose={() => setPracticeOpen(false)}
        />
      )}
    </BoardSettingsProvider>
  );
}
