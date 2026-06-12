'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTree,
  nodeAtPath,
  addMove,
  pathToMainline,
  mainlineEndPath,
  type AnalysisNode,
  type TreePath,
} from '@/lib/board/analysis-tree';
import { loadRules, peekRules, type RulesModule } from '@/lib/board/rules-lazy';
import type { Move, Square, PieceType, WireMove } from '@purechess/shared';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface AnalysisTreeState {
  root: AnalysisNode;
  fen: string;
  path: TreePath;
  lastMove: { from: Square; to: Square } | null;
  isOnMainline: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  // Navigation — same shape as useGameReview for drop-in compatibility.
  goNext: () => void;
  goPrev: () => void;
  goStart: () => void;
  goEnd: () => void;
  goToPath: (path: TreePath) => void;
  // Interactive.
  playMove: (from: Square, to: Square, promotion?: PieceType) => void;
  /** All legal moves at the current position; empty while chess.js loads. */
  legalMoves: Move[];
}

/**
 * Branching-tree counterpart of `useGameReview` for the /analyze board: the
 * pasted game is the mainline, played moves branch off it (transpositions
 * re-enter existing branches). The tree is mutated in place; every change
 * also moves `path`, which is what triggers re-render.
 */
export function useAnalysisTree(
  game: Pick<
    { moves: WireMove[]; startFen?: string; tree?: AnalysisNode },
    'moves' | 'startFen' | 'tree'
  >,
): AnalysisTreeState {
  const startFen = game.startFen ?? STARTING_FEN;
  // An imported PGN tree (variations preserved) wins over the flat move list.
  const root = useMemo(
    () => game.tree ?? buildTree(startFen, game.moves),
    [game.tree, startFen, game.moves],
  );
  const [path, setPath] = useState<TreePath>([]);
  // A new tree (new pasted game) invalidates any old path.
  useEffect(() => setPath([]), [root]);

  const node = nodeAtPath(root, path) ?? root;
  const fen = node.fen;

  const lastMove = useMemo((): { from: Square; to: Square } | null => {
    if (node.uci.length < 4) return null;
    return { from: node.uci.slice(0, 2) as Square, to: node.uci.slice(2, 4) as Square };
  }, [node]);

  // Legal moves recompute when the position changes; empty while the lazy
  // rules chunk loads (board renders without hints briefly — acceptable).
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  useEffect(() => {
    let disposed = false;
    void loadRules().then((r) => {
      if (!disposed) setLegalMoves(r.getAllLegalMoves(fen));
    });
    return () => {
      disposed = true;
    };
  }, [fen]);

  // playMove before chess.js resolves queues the latest intent and fires it
  // on load (single-slot queue — a second early move replaces the first).
  const pendingRef = useRef<{ from: Square; to: Square; promotion?: PieceType } | null>(null);
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const pathRef = useRef(path);
  pathRef.current = path;

  const apply = (r: RulesModule, from: Square, to: Square, promotion?: PieceType) => {
    const result = r.makeMove(fenRef.current, { from, to, promotion });
    if (!result) return;
    const next = addMove(root, pathRef.current, result.fenAfter, result.san, result.uci);
    if (next) setPath(next);
  };

  const playMove = (from: Square, to: Square, promotion?: PieceType) => {
    const r = peekRules();
    if (r) {
      apply(r, from, to, promotion);
      return;
    }
    pendingRef.current = { from, to, promotion };
    void loadRules().then((loaded) => {
      const queued = pendingRef.current;
      pendingRef.current = null;
      if (queued) apply(loaded, queued.from, queued.to, queued.promotion);
    });
  };

  const goToPath = (p: TreePath) => {
    if (nodeAtPath(root, p)) setPath(p);
  };

  return {
    root,
    fen,
    path,
    lastMove,
    isOnMainline: pathToMainline(root, path),
    canGoNext: node.children.length > 0,
    canGoPrev: path.length > 0,
    goNext: () => {
      if (node.children.length > 0) setPath([...path, 0]);
    },
    goPrev: () => setPath(path.slice(0, -1)),
    goStart: () => setPath([]),
    goEnd: () => setPath(mainlineEndPath(root)),
    goToPath,
    playMove,
    legalMoves,
  };
}
