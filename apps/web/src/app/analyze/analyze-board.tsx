'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlipVertical2, User } from 'lucide-react';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import {
  GameShell,
  BoardColumn,
  GameRail,
  GameTopBar,
  type PlayerStripProps,
} from '@/components/game';
import { formatResult, formatTermination } from '@/app/games/[gameId]/review-client';
import { AnalysisMovePanel } from '@/components/review/analysis-move-panel';
import { OpeningExplorer } from '@/components/review/opening-explorer';
import { ReviewControls } from '@/components/review/review-controls';
import { EvalBar, EngineLines } from '@/components/review/eval-panel';
import { PgnActions } from '@/components/review/pgn-actions';
import { useAnalysisTree } from '@/hooks/use-analysis-tree';
import { useOpeningName } from '@/hooks/use-opening-name';
import { usePositionEval } from '@/hooks/use-position-eval';
import { bestMoveArrow, type BoardShape } from '@/lib/board/annotations';
import { nodeAtPath } from '@/lib/board/analysis-tree';
import { computeMaterial } from '@/lib/board/material';
import { cn } from '@/lib/utils';
import { GameResult, type MoveIntent, type PieceType, type Square } from '@purechess/shared';
import type { AnalysisReview, ReviewPlayer } from '@/types/game-review';

type Color = 'white' | 'black';

/** GameResult → PGN Result tag value. */
const PGN_RESULT: Record<GameResult, string> = {
  [GameResult.WhiteWins]: '1-0',
  [GameResult.BlackWins]: '0-1',
  [GameResult.Draw]: '1/2-1/2',
};

interface AnalyzeBoardProps {
  game: AnalysisReview;
  /** Left-rail action (the "New analysis" button). */
  exitAction?: React.ReactNode;
}

function ratingLabel(player: ReviewPlayer): string {
  return player.rating > 0 ? String(player.rating) : 'Unrated';
}

/** Plies played before the start position — drives move numbering. */
function pliesBefore(startFen?: string): number {
  if (!startFen) return 0;
  const fields = startFen.split(' ');
  const fullmove = Number.parseInt(fields[5] ?? '1', 10) || 1;
  return (fullmove - 1) * 2 + (fields[1] === 'b' ? 1 : 0);
}

/**
 * Interactive analysis board for /analyze: the pasted game is the mainline,
 * any move played on the board branches off it into the analysis tree.
 * ReviewClient stays the read-only shell for /games/[gameId].
 */
export function AnalyzeBoard({ game, exitAction }: AnalyzeBoardProps) {
  const tree = useAnalysisTree(game);
  const [flipped, setFlipped] = useState(false);
  const { evaluation, thinking, lines } = usePositionEval(tree.fen, true, { multiPv: 3 });
  const opening = useOpeningName(tree.fen);
  // Hold the last book name so leaving book fades the text out instead of
  // snapping it blank mid-transition.
  const [heldOpening, setHeldOpening] = useState<string | null>(null);
  useEffect(() => {
    if (opening) setHeldOpening(opening);
  }, [opening]);

  // Engine lines as arrows: best move green, second line blue. Hidden while
  // thinking — a held evaluation belongs to the previous position (same
  // rationale as ReviewClient). User-drawn shapes render above these.
  const autoShapes = useMemo<BoardShape[]>(() => {
    if (thinking) return [];
    const shapes: BoardShape[] = [];
    const best = bestMoveArrow(evaluation?.pv[0] ?? evaluation?.bestmove);
    if (best) shapes.push(best);
    const second = bestMoveArrow(lines?.[1]?.pv[0], 'blue');
    if (second) shapes.push(second);
    return shapes;
  }, [thinking, evaluation, lines]);

  const orientation: Color = flipped ? 'black' : 'white';
  const bottomColor = orientation;
  const topColor: Color = bottomColor === 'white' ? 'black' : 'white';
  const sideToMove: Color = tree.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const material = computeMaterial(tree.fen);
  const startPly = pliesBefore(game.startFen);
  // Pasted games keep their honest outcome when the record supports one
  // (same rules as ReviewClient); otherwise the verdict is just "Analysis."
  const verdict =
    game.termination !== undefined ? `${formatTermination(game.termination)}.` : 'Analysis.';
  const resultLabel = game.result !== undefined ? formatResult(game.result) : null;

  function handleMove(intent: MoveIntent) {
    if (intent.from && intent.to) tree.playMove(intent.from, intent.to, intent.promotion);
  }

  // Explorer rows carry UCI; tree.playMove is transposition-aware (addMove
  // re-enters an existing branch), so a clicked book move never duplicates.
  const handleExplorerMove = useCallback(
    (uci: string) => {
      if (uci.length < 4) return;
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const promotion = uci.length === 5 ? (uci[4] as PieceType) : undefined;
      tree.playMove(from, to, promotion);
    },
    [tree],
  );

  // Shapes live on the tree node for the current position. Drawing/erasing
  // writes them through; navigating restores them. nodeAtPath returns the live
  // tree object — direct mutation is intentional (same pattern as addMove);
  // the path change that triggers re-render recomputes restoredShapes.
  const handleShapesChange = useCallback(
    (newShapes: BoardShape[]) => {
      const node = nodeAtPath(tree.root, tree.path);
      if (node) node.shapes = newShapes.length > 0 ? newShapes : undefined;
    },
    [tree.root, tree.path],
  );
  const currentNode = nodeAtPath(tree.root, tree.path) ?? tree.root;
  const restoredShapes = currentNode.shapes ?? [];

  // Annotated PGN export carries the players + outcome the record supports.
  const pgnHeaders = useMemo<Record<string, string>>(
    () => ({
      Event: 'Purechess Analysis',
      White: game.white.username,
      Black: game.black.username,
      Result: game.result !== undefined ? PGN_RESULT[game.result] : '*',
    }),
    [game.white.username, game.black.username, game.result],
  );

  function stripFor(color: Color): PlayerStripProps {
    const player = color === 'white' ? game.white : game.black;
    return {
      name: player.username,
      detail: `${color === 'white' ? 'White' : 'Black'} · ${ratingLabel(player)}`,
      side: color,
      active: color === sideToMove,
      subtle: true,
      avatar: <User className="h-5 w-5" aria-hidden="true" />,
      captured: color === 'white' ? material.byWhite : material.byBlack,
      capturedColor: color === 'white' ? 'b' : 'w',
      advantage: color === 'white' ? material.advantage : -material.advantage,
    };
  }

  const matchupLine = (
    <>
      {game.white.username} <span className="text-[#8a958a]">vs</span> {game.black.username} ·
      Analysis
    </>
  );

  return (
    <BoardSettingsProvider>
      <GameShell
        topBar={
          <GameTopBar
            center={
              // Opening name ↔ matchup crossfade as the position moves in
              // and out of book; both occupy the same grid cell.
              <span className="grid font-mono text-[11px] uppercase tracking-[0.18em] text-[#9da79c]">
                <span
                  className={cn(
                    'col-start-1 row-start-1 text-center transition-opacity duration-300',
                    opening ? 'opacity-0' : 'opacity-100',
                  )}
                  aria-hidden={Boolean(opening)}
                >
                  {matchupLine}
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
            <GameRail>
              <div className="px-4 pb-4 pt-5">
                <p className="font-display text-[26px] italic leading-[1.1] text-[#f1eee6]">
                  {verdict}
                </p>
                {resultLabel && (
                  <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-[#d6b563]">
                    {resultLabel}
                  </p>
                )}
                <p className="mt-1.5 text-sm text-[#9da79c]">
                  Play moves on the board to explore — lines branch off the game.
                </p>
              </div>
              <div
                aria-hidden="true"
                className="mx-4 h-px bg-gradient-to-r from-[#d6b563]/40 to-transparent"
              />
              <dl className="divide-y divide-[#232a24]/70 py-1 text-sm">
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-xs text-[#9da79c]">Time</dt>
                  <dd className="font-mono text-[13px] font-medium tabular-nums text-[#e7e3d6]">
                    {game.timeControl.label}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-xs text-[#9da79c]">Type</dt>
                  <dd className="font-mono text-[13px] font-medium tabular-nums text-[#e7e3d6]">
                    Analysis
                  </dd>
                </div>
              </dl>
              <div className="border-t border-[#2b332c] p-2.5">
                <PgnActions
                  pgn={game.pgn}
                  tree={tree.root}
                  pgnHeaders={pgnHeaders}
                  gameId={game.id}
                />
              </div>
            </GameRail>
            {exitAction}
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
              position={tree.fen}
              orientation={orientation}
              freePlay
              legalMoves={tree.legalMoves}
              onMove={handleMove}
              autoShapes={autoShapes}
              onShapesChange={handleShapesChange}
              externalShapes={restoredShapes}
              lastMove={tree.lastMove ?? undefined}
              className="[&_[role=grid]]:overflow-hidden [&_[role=grid]]:rounded-[3px] [&_[role=grid]]:shadow-[inset_0_0_0_1px_rgba(11,13,11,0.28)]"
            />
          </BoardColumn>
        }
        rightRail={
          <>
            {/* Self-hides (renders null) when the position is out of book. */}
            <OpeningExplorer fen={tree.fen} onMove={handleExplorerMove} className="mb-3 shrink-0" />
            <GameRail
              title="Moves"
              aside={
                <EngineLines
                  fen={tree.fen}
                  evaluation={evaluation}
                  thinking={thinking}
                  lines={lines}
                />
              }
              className="min-h-0 flex-1"
              bodyClassName="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1">
                <AnalysisMovePanel
                  root={tree.root}
                  currentPath={tree.path}
                  onSelect={tree.goToPath}
                  startPly={startPly}
                />
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#2b332c] p-2">
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  aria-label="Flip board"
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
                >
                  <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
                  Flip
                </button>
                <ReviewControls
                  onStart={tree.goStart}
                  onPrev={tree.goPrev}
                  onNext={tree.goNext}
                  onEnd={tree.goEnd}
                  atStart={!tree.canGoPrev}
                  atEnd={!tree.canGoNext}
                />
              </div>
            </GameRail>
          </>
        }
      />
    </BoardSettingsProvider>
  );
}
