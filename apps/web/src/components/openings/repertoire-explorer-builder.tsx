'use client';

import { useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { MoveIntent, PieceType, RepertoireColorDto, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { GameRail } from '@/components/game';
import { OpeningExplorer } from '@/components/review/opening-explorer';
import { AnalysisMovePanel } from '@/components/review/analysis-move-panel';
import { ReviewControls } from '@/components/review/review-controls';
import { Button } from '@/components/ui/button';
import { useAnalysisTree } from '@/hooks/use-analysis-tree';
import { buildTree, type AnalysisNode } from '@/lib/board/analysis-tree';

export interface RepertoireExplorerBuilderProps {
  color: RepertoireColorDto;
  startFen: string;
  saving: boolean;
  onSave: (tree: AnalysisNode) => void;
}

/**
 * Grows a repertoire tree from the start position. Reuses the analysis tree
 * hook (`useAnalysisTree`) + board + opening explorer + move panel verbatim —
 * playing a move on the board OR clicking an explorer row adds it to the tree
 * (transposition-aware via `addMove`). "Save" hands the live tree root up.
 */
export function RepertoireExplorerBuilder({
  color,
  startFen,
  saving,
  onSave,
}: RepertoireExplorerBuilderProps) {
  // Empty tree rooted at the start position; the hook mutates it in place.
  const emptyTree = useMemo(() => buildTree(startFen, []), [startFen]);
  const tree = useAnalysisTree({ moves: [], startFen, tree: emptyTree });
  const orientation = color;

  const handleMove = useCallback(
    (intent: MoveIntent) => {
      if (intent.from && intent.to) tree.playMove(intent.from, intent.to, intent.promotion);
    },
    [tree],
  );

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

  return (
    <BoardSettingsProvider>
      <div className="grid min-h-0 gap-4 lg:h-[calc(100dvh-var(--top-bar)-15rem)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="aspect-square w-full max-w-[min(100%,calc(100dvh-var(--top-bar)-20rem))] lg:h-full lg:max-h-full lg:w-auto lg:max-w-full">
              <Chessboard
                position={tree.fen}
                orientation={orientation}
                freePlay
                legalMoves={tree.legalMoves}
                onMove={handleMove}
                lastMove={tree.lastMove ?? undefined}
              />
            </div>
          </div>
          <div className="flex shrink-0 justify-center rounded-[10px] border border-[#2b332c] bg-[#121511] p-1.5 shadow-inner-hairline">
            <ReviewControls
              onStart={tree.goStart}
              onPrev={tree.goPrev}
              onNext={tree.goNext}
              onEnd={tree.goEnd}
              atStart={!tree.canGoPrev}
              atEnd={!tree.canGoNext}
            />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <OpeningExplorer fen={tree.fen} onMove={handleExplorerMove} className="shrink-0" />
          <GameRail
            title="Moves"
            className="min-h-[220px] min-w-0 flex-1 lg:min-h-0"
            bodyClassName="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-[160px] flex-1 overflow-hidden lg:min-h-0">
              <AnalysisMovePanel
                root={tree.root}
                currentPath={tree.path}
                onSelect={tree.goToPath}
              />
            </div>
          </GameRail>
          <Button
            onClick={() => onSave(tree.root)}
            disabled={saving || tree.root.children.length === 0}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : (
              'Save repertoire'
            )}
          </Button>
        </div>
      </div>
    </BoardSettingsProvider>
  );
}
