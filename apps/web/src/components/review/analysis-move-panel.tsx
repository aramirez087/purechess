'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { countMoves, type AnalysisNode, type TreePath } from '@/lib/board/analysis-tree';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface AnalysisMovePanelProps {
  root: AnalysisNode;
  currentPath: TreePath;
  onSelect: (path: TreePath) => void;
  /** Plies played before the root position (custom-FEN starts). */
  startPly?: number;
  className?: string;
}

function samePath(a: TreePath, b: TreePath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Imported-PGN annotation glyphs. NAG display beats computed classification. */
const NAG_SYMBOLS: Record<number, { symbol: string; color: string }> = {
  1: { symbol: '!', color: 'text-green-400' },
  2: { symbol: '?', color: 'text-orange-400' },
  3: { symbol: '!!', color: 'text-emerald-400' },
  4: { symbol: '??', color: 'text-red-500' },
  5: { symbol: '!?', color: 'text-yellow-400' },
  6: { symbol: '?!', color: 'text-yellow-400' },
};

function NagBadge({ nag }: { nag: number }) {
  const entry = NAG_SYMBOLS[nag];
  if (!entry) return null;
  return (
    <span className={cn('ml-0.5 font-mono text-[11px] font-semibold', entry.color)}>
      {entry.symbol}
    </span>
  );
}

function CommentIcon({ comment }: { comment: string }) {
  const text = comment.length > 200 ? `${comment.slice(0, 200)}…` : comment;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-1 inline-flex shrink-0 align-middle text-[#8a958a]">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Comment: {text}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] whitespace-normal">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function moveNo(ply: number): number {
  return Math.ceil(ply / 2);
}

function isWhitePly(ply: number): boolean {
  return ply % 2 === 1;
}

interface ChainToken {
  node: AnalysisNode;
  path: TreePath;
  ply: number;
  /** Index in the mainline chain; -1 inside variations. */
  idx: number;
}

interface ChainBranch {
  node: AnalysisNode;
  path: TreePath;
  ply: number;
}

/**
 * Move tree for the /analyze board. The mainline renders as the familiar
 * score-sheet rows; variations indent below the move they branch from as
 * muted inline lines. Only one level shows inline — deeper nesting collapses
 * to a "+N" chip with click-to-expand (deep nesting is rare in casual
 * analysis; don't optimize for it).
 */
export function AnalysisMovePanel({
  root,
  currentPath,
  onSelect,
  startPly = 0,
  className,
}: AnalysisMovePanelProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [currentPath]);

  // Mainline = the children[0] chain from root.
  const mainline: ChainToken[] = [];
  {
    let node = root.children[0];
    let path: TreePath = [0];
    let ply = startPly + 1;
    let idx = 0;
    while (node) {
      mainline.push({ node, path, ply, idx });
      node = node.children[0];
      path = [...path, 0];
      ply += 1;
      idx += 1;
    }
  }

  if (mainline.length === 0) {
    return (
      <div className={cn('h-full overflow-y-auto text-sm', className)}>
        <p className="font-display px-4 py-5 text-[15px] italic text-[#7f897f]">
          No moves yet — play a move on the board.
        </p>
      </div>
    );
  }

  // Alternatives to mainline[i] live on its parent (mainline[i-1] or root).
  const variationsAt = (i: number): ChainBranch[] => {
    const parent = i === 0 ? root : mainline[i - 1].node;
    const parentPath = i === 0 ? [] : mainline[i - 1].path;
    return parent.children.slice(1).map((node, k) => ({
      node,
      path: [...parentPath, k + 1],
      ply: mainline[i].ply,
    }));
  };

  // Group mainline plies into score-sheet rows by move number; a black-to-move
  // start leaves the first row's white cell empty.
  interface Row {
    no: number;
    white?: ChainToken;
    black?: ChainToken;
  }
  const rows: Row[] = [];
  for (const token of mainline) {
    const no = moveNo(token.ply);
    let row = rows[rows.length - 1];
    if (!row || row.no !== no) {
      row = { no };
      rows.push(row);
    }
    if (isWhitePly(token.ply)) row.white = token;
    else row.black = token;
  }

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={cn('h-full overflow-y-auto text-sm', className)}>
      <div className="flex flex-col py-0.5">
        {rows.map((row) => {
          const whiteVars = row.white ? variationsAt(row.white.idx) : [];
          const blackVars = row.black ? variationsAt(row.black.idx) : [];
          return (
            <div key={row.no}>
              <div className="flex items-stretch">
                <span className="flex w-9 shrink-0 items-center justify-end border-b border-transparent py-1 pl-2 pr-2.5 font-mono text-[11px] tabular-nums text-[#8a958a]">
                  {row.no}.
                </span>
                <MainlineCell token={row.white} currentPath={currentPath} onSelect={onSelect} activeRef={activeRef} />
                <MainlineCell token={row.black} currentPath={currentPath} onSelect={onSelect} activeRef={activeRef} />
              </div>
              {[...whiteVars, ...blackVars].map((branch) => (
                <VariationLine
                  key={branch.path.join('.')}
                  branch={branch}
                  depth={1}
                  currentPath={currentPath}
                  onSelect={onSelect}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  activeRef={activeRef}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MainlineCell({
  token,
  currentPath,
  onSelect,
  activeRef,
}: {
  token?: ChainToken;
  currentPath: TreePath;
  onSelect: (path: TreePath) => void;
  activeRef: React.RefObject<HTMLButtonElement>;
}) {
  if (!token) return <span className="w-1/2 px-2.5 py-1" aria-hidden="true" />;
  const active = samePath(token.path, currentPath);
  return (
    <button
      type="button"
      ref={active ? activeRef : undefined}
      onClick={() => onSelect(token.path)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'block w-1/2 px-2.5 py-1 text-left font-mono text-[13px] tabular-nums transition-colors hover:bg-[#181c17]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d6b563]',
        active
          ? 'bg-[#d6b563]/[0.12] text-[#f8f1de] shadow-[inset_2px_0_0_0_#d6b563]'
          : 'text-[#c9c3b2]',
      )}
    >
      {token.node.san}
      {token.node.nag !== undefined && <NagBadge nag={token.node.nag} />}
      {token.node.comment && <CommentIcon comment={token.node.comment} />}
    </button>
  );
}

function VariationLine({
  branch,
  depth,
  currentPath,
  onSelect,
  expanded,
  onToggle,
  activeRef,
}: {
  branch: ChainBranch;
  depth: number;
  currentPath: TreePath;
  onSelect: (path: TreePath) => void;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  activeRef: React.RefObject<HTMLButtonElement>;
}) {
  // Walk the variation's own children[0] chain; sub-branches collapse.
  const tokens: ChainToken[] = [];
  const subBranches: ChainBranch[] = [];
  {
    let node: AnalysisNode | undefined = branch.node;
    let path = branch.path;
    let ply = branch.ply;
    while (node) {
      tokens.push({ node, path, ply, idx: -1 });
      for (let k = 1; k < node.children.length; k++) {
        subBranches.push({ node: node.children[k], path: [...path, k], ply: ply + 1 });
      }
      node = node.children[0];
      path = [...path, 0];
      ply += 1;
    }
  }

  const key = branch.path.join('.');
  const isExpanded = expanded.has(key);
  const hiddenMoves = subBranches.reduce((n, b) => n + 1 + countMoves(b.node), 0);

  return (
    <div style={{ paddingLeft: `${0.75 + depth * 0.875}rem` }} className="pr-2">
      <div className="flex flex-wrap items-baseline gap-x-1 py-0.5">
        {tokens.map((token, i) => {
          const active = samePath(token.path, currentPath);
          const white = isWhitePly(token.ply);
          const prefix = white ? `${moveNo(token.ply)}.` : i === 0 ? `${moveNo(token.ply)}…` : null;
          return (
            <button
              key={token.path.join('.')}
              type="button"
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(token.path)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'rounded-[3px] px-1 py-0.5 font-mono text-[12px] tabular-nums transition-colors hover:bg-[#181c17] hover:text-[#e7e3d6]',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d6b563]',
                active ? 'bg-[#d6b563]/[0.14] text-[#f8f1de]' : 'text-[#8a948a]',
              )}
            >
              {prefix && <span className="mr-0.5 text-[10px] text-[#6f7a70]">{prefix}</span>}
              {token.node.san}
              {token.node.nag !== undefined && <NagBadge nag={token.node.nag} />}
              {token.node.comment && <CommentIcon comment={token.node.comment} />}
            </button>
          );
        })}
        {subBranches.length > 0 && (
          <button
            type="button"
            onClick={() => onToggle(key)}
            aria-expanded={isExpanded}
            className="rounded-[3px] px-1 py-0.5 font-mono text-[11px] text-[#6f7a70] transition-colors hover:bg-[#181c17] hover:text-[#c9c3b2] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d6b563]"
          >
            {isExpanded ? '− hide' : `… ${hiddenMoves} ${hiddenMoves === 1 ? 'move' : 'moves'}`}
          </button>
        )}
      </div>
      {isExpanded &&
        subBranches.map((sub) => (
          <VariationLine
            key={sub.path.join('.')}
            branch={sub}
            depth={depth + 1}
            currentPath={currentPath}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
            activeRef={activeRef}
          />
        ))}
    </div>
  );
}
