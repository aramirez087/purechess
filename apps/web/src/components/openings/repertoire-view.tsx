'use client';

import { useCallback } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import type { MoveIntent, RepertoireDto } from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { AnalysisMovePanel } from '@/components/review/analysis-move-panel';
import { ReviewControls } from '@/components/review/review-controls';
import { Button } from '@/components/ui/button';
import { useAnalysisTree } from '@/hooks/use-analysis-tree';
import type { AnalysisNode } from '@/lib/board/analysis-tree';

export interface RepertoireViewProps {
  repertoire: RepertoireDto;
  onBack: () => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

/**
 * Read view for a saved repertoire: renders the stored tree with the SAME
 * board + `AnalysisMovePanel` the /analyze page uses (not a fork). The tree
 * came from the server as a plain `RepertoireNodeDto` — structurally an
 * `AnalysisNode`. Playing moves explores further (kept in the local tree, not
 * persisted from here).
 */
export function RepertoireView({ repertoire, onBack, onDelete, deleting }: RepertoireViewProps) {
  const tree = useAnalysisTree({
    moves: [],
    startFen: repertoire.rootFen,
    tree: repertoire.tree as AnalysisNode,
  });
  const orientation = repertoire.color;

  const handleMove = useCallback(
    (intent: MoveIntent) => {
      if (intent.from && intent.to) tree.playMove(intent.from, intent.to, intent.promotion);
    },
    [tree],
  );

  return (
    <BoardSettingsProvider>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All repertoires
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl italic text-foreground">{repertoire.name}</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {repertoire.color}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(repertoire.id)}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>

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
            <div className="min-h-[200px] flex-1 overflow-hidden rounded-[10px] border border-border bg-surface/60">
              <AnalysisMovePanel
                root={tree.root}
                currentPath={tree.path}
                onSelect={tree.goToPath}
              />
            </div>
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
      </div>
    </BoardSettingsProvider>
  );
}
