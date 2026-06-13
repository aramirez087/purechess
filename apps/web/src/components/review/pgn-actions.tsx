'use client';

import { Copy, Download, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportTreeToPgn } from '@/lib/board/pgn-export';
import type { AnalysisNode } from '@/lib/board/analysis-tree';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PgnActionsProps {
  pgn: string;
  gameId: string;
  fen?: string;
  className?: string;
  /**
   * Analysis tree root. When provided, Copy/Download serialise the full tree
   * (variations + NAGs + comments + shapes) instead of the flat `pgn` string.
   */
  tree?: AnalysisNode;
  /** Headers ({ White, Black, Event, Result }) for the exported PGN. */
  pgnHeaders?: Record<string, string>;
}

function usePgnHandlers({ pgn, gameId, fen, tree, pgnHeaders }: PgnActionsProps) {
  const pgnText = tree ? exportTreeToPgn(tree, pgnHeaders) : pgn;

  function handleCopy() {
    navigator.clipboard
      .writeText(pgnText)
      .then(() => {
        toast.success('PGN copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy PGN');
      });
  }

  function handleCopyFen() {
    navigator.clipboard
      .writeText(fen!)
      .then(() => {
        toast.success('FEN copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy FEN');
      });
  }

  function handleDownload() {
    const blob = new Blob([pgnText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purechess-${gameId}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { handleCopy, handleCopyFen, handleDownload };
}

/**
 * Full-button variant, sized to dock as a panel footer: each action splits
 * the row evenly. Quiet outline look comes from the Button variant itself.
 */
export function PgnActions(props: PgnActionsProps) {
  const { handleCopy, handleCopyFen, handleDownload } = usePgnHandlers(props);

  return (
    <div className={cn('flex items-center gap-2', props.className)}>
      <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
        Copy PGN
      </Button>
      <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
        Download PGN
      </Button>
      {props.fen && (
        <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyFen}>
          Copy FEN
        </Button>
      )}
    </div>
  );
}

/**
 * Compact icon-only variant for tight chrome (e.g. the Moves panel header).
 * Same actions as <PgnActions/>, one 28px ghost button each.
 */
export function PgnIconActions(props: PgnActionsProps) {
  const { handleCopy, handleCopyFen, handleDownload } = usePgnHandlers(props);

  const buttonClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-[5px] text-[#8a948a] transition-colors hover:bg-white/5 hover:text-[#f1eee6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d6b563]';

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Copy PGN"
        title="Copy PGN"
        className={buttonClass}
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Download PGN"
        title="Download PGN"
        className={buttonClass}
        onClick={handleDownload}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {props.fen && (
        <button
          type="button"
          aria-label="Copy FEN"
          title="Copy FEN"
          className={buttonClass}
          onClick={handleCopyFen}
        >
          <Hash className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
