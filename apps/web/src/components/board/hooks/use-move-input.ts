'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MoveIntent } from '@purechess/shared';
import type { MoveMatch } from '@/lib/board/legal-sans';

type LegalSansModule = typeof import('@/lib/board/legal-sans');

interface UseMoveInputOptions {
  fen: string | null;
  onMove: (move: MoveIntent) => void;
  /** false in read-only / off-turn contexts — openWith becomes a no-op. */
  enabled?: boolean;
}

export interface UseMoveInputReturn {
  open: boolean;
  query: string;
  matches: MoveMatch[];
  selectedIdx: number;
  openWith: (initial?: string) => void;
  close: () => void;
  setQuery: (q: string) => void;
  setSelectedIdx: (idx: number) => void;
  confirm: (match?: MoveMatch) => void;
  /** Returns true when the key was consumed (nav/confirm/dismiss). */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

/**
 * Command-palette text move input: SAN ("Nf3") or UCI ("g1f3") with live
 * autocomplete over the position's legal moves. The legal-sans module (and
 * with it chess.js) loads on first open, never in the eager board chunk.
 */
export function useMoveInput({
  fen,
  onMove,
  enabled = true,
}: UseMoveInputOptions): UseMoveInputReturn {
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mod, setMod] = useState<LegalSansModule | null>(null);
  const [allMoves, setAllMoves] = useState<MoveMatch[]>([]);
  // Arrow/Tab navigation overrides the Enter default (queen on a bare
  // origin+dest promotion query); any query edit resets it.
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!open || !fen) return;
    let disposed = false;
    void import('@/lib/board/legal-sans').then((m) => {
      if (disposed) return;
      setMod(m);
      setAllMoves(m.legalSans(fen));
    });
    return () => {
      disposed = true;
    };
  }, [open, fen]);

  useEffect(() => {
    if (open && !enabled) {
      setOpen(false);
      setQueryState('');
      setSelectedIdx(0);
    }
  }, [open, enabled]);

  const matches = useMemo(
    () => (open && mod ? mod.filterMoves(allMoves, query) : []),
    [open, mod, allMoves, query],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQueryState('');
    setSelectedIdx(0);
    navigatedRef.current = false;
  }, []);

  const openWith = useCallback(
    (initial = '') => {
      if (!enabled || !fen) return;
      setOpen(true);
      setQueryState(initial);
      setSelectedIdx(0);
      navigatedRef.current = false;
    },
    [enabled, fen],
  );

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    setSelectedIdx(0);
    navigatedRef.current = false;
  }, []);

  const confirm = useCallback(
    (match?: MoveMatch) => {
      let m = match;
      if (!m && !navigatedRef.current) {
        // Enter on "e7e8" with all four promotions listed → queen.
        const q = query.trim().toLowerCase();
        m = matches.find((x) => x.uci === q + 'q');
      }
      m ??= matches[selectedIdx];
      if (!m) return;
      close();
      onMove({
        from: m.from,
        to: m.to,
        promotion: m.promotion as MoveIntent['promotion'],
      });
    },
    [matches, selectedIdx, query, close, onMove],
  );

  // Auto-confirm: unique match + the query spells the whole move ("e4",
  // "e2e4"). isFullMatch refuses 2-char partials.
  useEffect(() => {
    if (!open || !mod || query.trim().length < 2) return;
    if (matches.length !== 1) return;
    if (mod.isFullMatch(matches[0], query)) confirm(matches[0]);
  }, [open, mod, query, matches, confirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!open) return false;
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          navigatedRef.current = true;
          setSelectedIdx((i) => (matches.length ? (i + 1) % matches.length : 0));
          return true;
        }
        case 'ArrowUp': {
          e.preventDefault();
          navigatedRef.current = true;
          setSelectedIdx((i) => (matches.length ? (i - 1 + matches.length) % matches.length : 0));
          return true;
        }
        case 'Tab': {
          e.preventDefault();
          navigatedRef.current = true;
          const dir = e.shiftKey ? -1 : 1;
          setSelectedIdx((i) => (matches.length ? (i + dir + matches.length) % matches.length : 0));
          return true;
        }
        case 'Enter': {
          e.preventDefault();
          confirm();
          return true;
        }
        case 'Escape': {
          e.preventDefault();
          e.stopPropagation();
          close();
          return true;
        }
        default:
          // Printable keys fall through to the <input>'s native editing
          // (onChange → setQuery) — appending here would double-insert.
          return false;
      }
    },
    [open, matches, confirm, close],
  );

  return {
    open,
    query,
    matches,
    selectedIdx,
    openWith,
    close,
    setQuery,
    setSelectedIdx,
    confirm,
    handleKeyDown,
  };
}
