'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { UseMoveInputReturn } from './hooks/use-move-input';

/**
 * Floating command-palette over the board for typed moves. Renders only
 * while the move input is open; key handling lives in use-move-input — this
 * component only feeds it events and paints the match list.
 */
export function MoveInputOverlay({
  open,
  query,
  matches,
  selectedIdx,
  setQuery,
  setSelectedIdx,
  confirm,
  handleKeyDown,
}: UseMoveInputReturn) {
  if (!open) return null;
  return (
    <MoveInputPanel
      query={query}
      matches={matches}
      selectedIdx={selectedIdx}
      setQuery={setQuery}
      setSelectedIdx={setSelectedIdx}
      confirm={confirm}
      handleKeyDown={handleKeyDown}
    />
  );
}

type PanelProps = Pick<
  UseMoveInputReturn,
  'query' | 'matches' | 'selectedIdx' | 'setQuery' | 'setSelectedIdx' | 'confirm' | 'handleKeyDown'
>;

function MoveInputPanel({
  query,
  matches,
  selectedIdx,
  setQuery,
  setSelectedIdx,
  confirm,
  handleKeyDown,
}: PanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Focus the input on open; hand focus back to the board grid on close so
  // keyboard users keep their place (same contract as the promotion dialog).
  useEffect(() => {
    inputRef.current?.focus();
    const grid =
      rootRef.current
        ?.closest('[data-testid="chess-board"]')
        ?.querySelector<HTMLElement>('[role="grid"]') ??
      document.querySelector<HTMLElement>('[role="grid"]');
    return () => {
      grid?.focus();
    };
  }, []);

  // Keep the active row in view while arrowing through a long list.
  useEffect(() => {
    rootRef.current
      ?.querySelector(`[data-match-idx="${selectedIdx}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIdx]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Move input"
      className="absolute inset-x-0 top-[10%] z-40 mx-auto w-[220px]"
      // The hook owns key handling; stop propagation so the board grid's
      // arrow-nav / open-trigger handlers never double-process these keys.
      onKeyDown={(e) => {
        handleKeyDown(e);
        e.stopPropagation();
      }}
      // Clicks on the palette must not reach the board (square selection,
      // annotation sweep).
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="overflow-hidden rounded-[10px] border border-[#2b332c]/90 bg-gradient-to-b from-[#121511] to-[#0b0d0b] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.8),0_0_60px_-24px_rgba(214,181,99,0.35)]">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={matches.length ? `${listId}-${selectedIdx}` : undefined}
          aria-label="Type a move"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a move…"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="w-full border-b border-[#2b332c]/70 bg-transparent px-3 py-2 font-mono text-sm text-[#e9e4d4] placeholder:text-[#8a958a] focus:outline-none"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching moves"
          className="max-h-48 overflow-y-auto py-1"
        >
          {matches.length === 0 && (
            <li className="px-3 py-1.5 font-mono text-xs text-[#8a958a]" role="presentation">
              No legal move
            </li>
          )}
          {matches.map((m, i) => (
            <li
              key={m.uci}
              id={`${listId}-${i}`}
              data-match-idx={i}
              role="option"
              aria-selected={i === selectedIdx}
              className={cn(
                'flex cursor-pointer items-baseline justify-between px-3 py-1.5 font-mono text-sm',
                i === selectedIdx ? 'bg-[#d6b563]/15 text-[#e9e4d4]' : 'text-[#9da79c]',
              )}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => confirm(m)}
            >
              <span>{m.san}</span>
              <span className="text-xs text-[#8a958a]">→ {m.to}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
