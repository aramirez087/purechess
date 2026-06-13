'use client';

import { useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { MoveIntent, PieceType, RepertoireColorDto, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-[460px]">
          <Chessboard
            position={tree.fen}
            orientation={orientation}
            freePlay
            legalMoves={tree.legalMoves}
            onMove={handleMove}
            lastMove={tree.lastMove ?? undefined}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <OpeningExplorer fen={tree.fen} onMove={handleExplorerMove} />
          <div className="min-h-[160px] flex-1 overflow-hidden rounded-[10px] border border-border bg-surface/60">
            <AnalysisMovePanel root={tree.root} currentPath={tree.path} onSelect={tree.goToPath} />
          </div>
          <ReviewControls
            onStart={tree.goStart}
            onPrev={tree.goPrev}
            onNext={tree.goNext}
            onEnd={tree.goEnd}
            atStart={!tree.canGoPrev}
            atEnd={!tree.canGoNext}
          />
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
