'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Shuffle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ECO_OPENINGS, getEcoFen, randomOpening } from '@/lib/openings';

const MAX_RESULTS = 40;

interface OpeningPickerProps {
  onSelect: (fen: string, name: string, code: string) => void;
}

interface SelectedOpening {
  fen: string;
  name: string;
  code: string;
}

export function OpeningPicker({ onSelect }: OpeningPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedOpening | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const filtered = query.trim()
    ? ECO_OPENINGS.filter(
        (e) =>
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.code.toLowerCase().startsWith(query.toLowerCase()),
      ).slice(0, MAX_RESULTS)
    : ECO_OPENINGS.slice(0, MAX_RESULTS);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function select(fen: string, name: string, code: string) {
    setSelected({ fen, name, code });
    setQuery('');
    setOpen(false);
    onSelect(fen, name, code);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleInputFocus() {
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, filtered.length - 1);
      setActiveIndex(next);
      scrollActiveIntoView(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      scrollActiveIntoView(prev);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = filtered[activeIndex];
      if (entry) select(getEcoFen(entry), entry.name, entry.code);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function scrollActiveIntoView(idx: number) {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[idx] as HTMLElement | undefined;
    item?.scrollIntoView?.({ block: 'nearest' });
  }

  function handleRandom() {
    const result = randomOpening();
    select(result.fen, result.name, result.code);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  const activeItemId = open && filtered[activeIndex] ? `${listboxId}-item-${activeIndex}` : undefined;

  return (
    <div className="space-y-2" onBlur={handleBlur}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeItemId}
          aria-label="Search opening"
          placeholder="Search opening by name or ECO code…"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full rounded-md px-3 py-2 text-sm',
            'border border-border/70 bg-raised/40 text-foreground',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition-colors',
          )}
        />

        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Openings"
            className={cn(
              'absolute z-50 mt-1 w-full overflow-y-auto rounded-md py-1',
              'border border-border/70 bg-surface shadow-elevated',
              'max-h-56',
            )}
          >
            {filtered.map((entry, idx) => (
              <li
                key={entry.code + ':' + entry.moves}
                id={`${listboxId}-item-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(getEcoFen(entry), entry.name, entry.code);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                  idx === activeIndex
                    ? 'bg-raised text-foreground'
                    : 'text-muted-foreground hover:bg-raised/60 hover:text-foreground',
                )}
              >
                <span className="w-10 shrink-0 font-mono text-xs text-brass">{entry.code}</span>
                <span className="truncate">{entry.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={handleRandom}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm',
          'border border-border/70 bg-raised/40 text-muted-foreground',
          'hover:border-foreground/40 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'transition-colors',
        )}
      >
        <Shuffle className="h-3.5 w-3.5" />
        Random Opening
      </button>

      {selected && (
        <div
          className={cn(
            'flex items-center justify-between rounded-md px-3 py-2',
            'border border-brass/40 bg-brass/5',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 font-mono text-xs text-brass">{selected.code}</span>
            <span className="truncate text-sm text-foreground">{selected.name}</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selected opening"
            className={cn(
              'ml-2 shrink-0 rounded p-0.5 text-muted-foreground',
              'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
