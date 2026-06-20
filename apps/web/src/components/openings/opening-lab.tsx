'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chess } from 'chess.js';
import {
  ArrowLeft,
  BookOpen,
  FlaskConical,
  FlipVertical2,
  Save,
  Search,
  Swords,
  Target,
} from 'lucide-react';
import type { MoveIntent, PieceType, Square } from '@purechess/shared';
import { Chessboard } from '@/components/board';
import { BoardSettingsProvider } from '@/components/board/board-context';
import { PracticeFromFenDialog } from '@/components/play/practice-from-fen-dialog';
import { SaveToRepertoireDialog } from '@/components/openings/save-to-repertoire-dialog';
import { OpeningExplorer } from '@/components/review/opening-explorer';
import { AnalysisMovePanel } from '@/components/review/analysis-move-panel';
import { ReviewControls } from '@/components/review/review-controls';
import { Button } from '@/components/ui/button';
import { useAnalysisTree } from '@/hooks/use-analysis-tree';
import { useOpeningName } from '@/hooks/use-opening-name';
import { buildTree } from '@/lib/board/analysis-tree';
import { parsePgnToTree, STARTING_FEN } from '@/lib/board/pgn-parser';
import { formatOpeningPgn } from '@/lib/openings/format-pgn';
import {
  getFamily,
  loadOpeningBook,
  searchOpenings,
  type OpeningBook,
  type OpeningEntry,
  type OpeningFamily,
} from '@/lib/openings/opening-book';
import { cn } from '@/lib/utils';



export interface OpeningLabProps {
  initialQuery?: string;
  initialFamily?: string;
}

export function OpeningLab({ initialQuery = '', initialFamily = '' }: OpeningLabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [book, setBook] = useState<OpeningBook | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(
    initialFamily || null,
  );
  const [active, setActive] = useState<OpeningEntry | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [drillColor, setDrillColor] = useState<'white' | 'black'>('white');

  const startFen = active?.pgn ? STARTING_FEN : (active?.fen ?? STARTING_FEN);
  const baseTree = useMemo(() => {
    if (active?.pgn) {
      try {
        return parsePgnToTree(active.pgn, Chess).root;
      } catch {
        return buildTree(active.fen, []);
      }
    }
    return buildTree(startFen, []);
  }, [active, startFen]);
  const tree = useAnalysisTree({ moves: [], startFen, tree: baseTree });
  const lineText = active?.pgn ? formatOpeningPgn(active.pgn) : '';
  const liveName = useOpeningName(tree.fen);
  const displayName = liveName ?? active?.name ?? 'Starting position';

  const orientation = flipped ? 'black' : 'white';

  useEffect(() => {
    let disposed = false;
    loadOpeningBook()
      .then((b) => {
        if (!disposed) setBook(b);
      })
      .catch(() => {
        if (!disposed) setLoadError(true);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const selectEntry = useCallback(
    (entry: OpeningEntry | null) => {
      setActive(entry);
      if (entry) setSelectedFamily(entry.family);
      setFlipped(false);
      const params = new URLSearchParams(searchParams.toString());
      if (entry) {
        params.set('q', entry.name);
        params.delete('family');
      } else {
        params.delete('q');
      }
      router.replace(`/openings/lab?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Deep-link: ?q= or ?family= on first load once the book is ready.
  useEffect(() => {
    if (!book || active) return;
    const q = initialQuery.trim();
    const fam = initialFamily.trim();
    if (q) {
      const hit = searchOpenings(book, q, 1)[0];
      if (hit) {
        setActive(hit);
        setSelectedFamily(hit.family);
        return;
      }
    }
    if (fam) {
      const family = getFamily(book, fam);
      if (family) {
        setSelectedFamily(family.name);
        if (family.entries[0]) setActive(family.entries[0]);
      }
    }
  }, [book, initialQuery, initialFamily, active]);

  const searchResults = useMemo(
    () => (book && query.trim() ? searchOpenings(book, query) : []),
    [book, query],
  );

  const family: OpeningFamily | undefined =
    book && selectedFamily ? getFamily(book, selectedFamily) : undefined;

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

  function handleFamilyClick(name: string) {
    setSelectedFamily(name);
    setQuery('');
    const params = new URLSearchParams();
    params.set('family', name);
    router.replace(`/openings/lab?${params.toString()}`, { scroll: false });
    const fam = book ? getFamily(book, name) : undefined;
    if (fam?.entries[0]) setActive(fam.entries[0]);
  }

  return (
    <BoardSettingsProvider>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10">
        <header className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/openings"
              className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Repertoire
            </Link>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-brass" aria-hidden="true" />
              <h1 className="font-display text-3xl italic tracking-[-0.01em] text-foreground sm:text-4xl">
                Opening Lab
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Browse 3,700+ named lines — Italian, Fegatello, and everything in between. Pick a
              variation, explore what masters play, and branch on the board.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {selectedFamily ? (
              <Button asChild variant="default">
                <Link
                  href={`/openings/lab/drill?family=${encodeURIComponent(selectedFamily)}&color=${drillColor}`}
                >
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Drill {selectedFamily}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/openings">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                My repertoire
              </Link>
            </Button>
          </div>
        </header>

        {loadError ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Could not load the opening book. Refresh and try again.
          </p>
        ) : (
          <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,320px)] lg:items-start">
            <aside className="flex max-h-[70vh] flex-col gap-3 overflow-hidden rounded-[12px] border border-border bg-surface/60 lg:sticky lg:top-[calc(var(--top-bar,3.5rem)+1rem)]">
              <div className="border-b border-border/60 p-3">
                <label className="sr-only" htmlFor="opening-lab-search">
                  Search openings
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="opening-lab-search"
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedFamily(null);
                    }}
                    placeholder="e.g. Fegatello, Italian…"
                    className="h-9 w-full rounded-[8px] border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brass/50"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {!book ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>
                ) : query.trim() ? (
                  <VariationList
                    entries={searchResults}
                    activeEpd={active?.epd}
                    onSelect={selectEntry}
                    emptyLabel="No lines match that search."
                  />
                ) : selectedFamily && family ? (
                  <VariationList
                    entries={family.entries}
                    activeEpd={active?.epd}
                    onSelect={selectEntry}
                    heading={family.name}
                  />
                ) : (
                  <FamilyList
                    families={book.families}
                    activeFamily={selectedFamily}
                    onSelect={handleFamilyClick}
                  />
                )}
              </div>
            </aside>

            <main className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-foreground">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-text">
                    Position
                  </span>
                  <span className="mt-0.5 block truncate">{displayName}</span>
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {selectedFamily ? (
                    <div className="flex items-center gap-1 rounded-[8px] border border-border p-0.5">
                      {(['white', 'black'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDrillColor(c)}
                          className={cn(
                            'rounded-[6px] px-2 py-1 text-xs capitalize transition-colors',
                            drillColor === c
                              ? 'bg-brass/15 font-medium text-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFlipped((f) => !f)}
                    aria-label="Flip board"
                  >
                    <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveOpen(true)}
                    disabled={tree.root.children.length === 0}
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save line
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPracticeOpen(true)}>
                    <Swords className="h-4 w-4" aria-hidden="true" />
                    Practice
                  </Button>
                </div>
              </div>

              {lineText ? (
                <p className="rounded-[10px] border border-border/60 bg-surface/40 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                  <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-brass-text">
                    Line{' '}
                  </span>
                  {lineText}
                </p>
              ) : null}

              <div className="mx-auto w-full max-w-[min(100%,520px)]">
                <Chessboard
                  position={tree.fen}
                  orientation={orientation}
                  freePlay
                  legalMoves={tree.legalMoves}
                  onMove={handleMove}
                  lastMove={tree.lastMove ?? undefined}
                />
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Play moves on the board or pick from the explorer — branches stay in this session.
                Save lines permanently via{' '}
                <Link href="/openings" className="text-brass-text underline-offset-2 hover:underline">
                  My repertoire
                </Link>
                .
              </p>
            </main>

            <aside className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-[calc(var(--top-bar,3.5rem)+1rem)]">
              <OpeningExplorer fen={tree.fen} onMove={handleExplorerMove} />
              <div className="min-h-[180px] flex-1 overflow-hidden rounded-[10px] border border-border bg-surface/60">
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
            </aside>
          </div>
        )}
      </div>

      <PracticeFromFenDialog fen={tree.fen} open={practiceOpen} onClose={() => setPracticeOpen(false)} />
      <SaveToRepertoireDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        tree={tree.root}
        suggestedName={active?.name ?? 'Lab line'}
      />
    </BoardSettingsProvider>
  );
}

function FamilyList({
  families,
  activeFamily,
  onSelect,
}: {
  families: OpeningFamily[];
  activeFamily: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {families.map((family) => {
        const active = family.name === activeFamily;
        return (
          <li key={family.name}>
            <button
              type="button"
              onClick={() => onSelect(family.name)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors',
                active
                  ? 'bg-brass/15 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-raised hover:text-foreground',
              )}
            >
              <span className="truncate">{family.name}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {family.entries.length}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function VariationList({
  entries,
  activeEpd,
  onSelect,
  heading,
  emptyLabel = 'No variations.',
}: {
  entries: OpeningEntry[];
  activeEpd?: string;
  onSelect: (entry: OpeningEntry) => void;
  heading?: string;
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {heading ? (
        <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {heading}
        </p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry) => {
          const active = entry.epd === activeEpd;
          const label = entry.variation || entry.name;
          return (
            <li key={entry.epd}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={cn(
                  'w-full rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-brass/15 font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-raised hover:text-foreground',
                )}
              >
                <span className="line-clamp-2">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}