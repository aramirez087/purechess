'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  X,
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
import { buildTree, type AnalysisNode, type TreePath } from '@/lib/board/analysis-tree';
import { parsePgnToTree, STARTING_FEN } from '@/lib/board/pgn-parser';
import {
  getFamily,
  loadOpeningBook,
  searchOpenings,
  type OpeningBook,
  type OpeningEntry,
  type OpeningFamily,
} from '@/lib/openings/opening-book';
import { GameRail } from '@/components/game';
import { cn } from '@/lib/utils';

/** SAN text along `path` — used in the fixed-height line strip above the board. */
function formatPathLine(root: AnalysisNode, path: TreePath): string {
  const parts: string[] = [];
  let node = root;
  let ply = 1;
  for (const idx of path) {
    const child = node.children[idx];
    if (!child) break;
    if (ply % 2 === 1) parts.push(`${Math.ceil(ply / 2)}. ${child.san}`);
    else parts.push(child.san);
    node = child;
    ply += 1;
  }
  return parts.join(' ');
}

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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [drillColor, setDrillColor] = useState<'white' | 'black'>('white');
  const lineStripRef = useRef<HTMLDivElement>(null);

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
  const pathLine = useMemo(() => formatPathLine(tree.root, tree.path), [tree.root, tree.path]);
  const liveName = useOpeningName(tree.fen);
  const [heldName, setHeldName] = useState<string | null>(null);
  useEffect(() => {
    if (liveName) setHeldName(liveName);
  }, [liveName]);
  const displayName = liveName ?? heldName ?? active?.name ?? 'Starting position';

  const orientation = flipped ? 'black' : 'white';

  useEffect(() => {
    const el = lineStripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [pathLine]);

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
      setCatalogOpen(false);
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
    setCatalogOpen(false);
  }

  const renderCatalog = (searchId: string) => (
    <>
      <div className="border-b border-border/60 p-3">
        <label className="sr-only" htmlFor={searchId}>
          Search openings
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id={searchId}
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
    </>
  );

  return (
    <BoardSettingsProvider>
      <div className="opening-lab-shell mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-6 lg:flex-none lg:min-h-0 lg:overflow-hidden lg:py-4">
        <header className="flex shrink-0 flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between lg:pb-3">
          <div className="min-w-0">
            <Link
              href="/openings"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Repertoire
            </Link>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-brass" aria-hidden="true" />
              <h1 className="font-display text-2xl italic tracking-[-0.01em] text-foreground sm:text-3xl">
                Opening Lab
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground lg:line-clamp-1">
              Browse 3,700+ named lines — pick a variation, explore what masters play, and branch on
              the board.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {selectedFamily ? (
              <Button asChild variant="default" size="sm">
                <Link
                  href={`/openings/lab/drill?family=${encodeURIComponent(selectedFamily)}&color=${drillColor}`}
                >
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Drill {selectedFamily}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
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
          <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:mt-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(300px,380px)] lg:gap-5 lg:overflow-hidden">
            <aside className="hidden min-w-0 flex-col overflow-hidden rounded-[12px] border border-border bg-surface/60 lg:flex lg:h-full">
              {renderCatalog('opening-lab-search')}
            </aside>

            <main className="order-1 flex min-h-0 min-w-0 flex-col gap-2 lg:order-none lg:h-full lg:min-h-[320px] lg:overflow-hidden">
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="flex min-h-12 shrink-0 items-center justify-between gap-3 rounded-[10px] border border-border bg-surface/60 px-3 py-2 text-left shadow-inner-hairline transition-colors hover:border-brass/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 lg:hidden"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-brass-text">
                    Opening browser
                  </span>
                  <span className="block truncate text-sm font-medium text-foreground">
                    {selectedFamily ?? active?.name ?? 'Search named lines'}
                  </span>
                </span>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>

              <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="h-[3.25rem] min-w-0 flex-1 overflow-hidden">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-text">
                    Position
                  </span>
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {displayName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
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

              <div className="grid shrink-0 gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div
                  ref={lineStripRef}
                  className="flex h-9 min-w-0 items-center gap-2 overflow-x-auto rounded-[10px] border border-border/60 bg-surface/40 px-3"
                  aria-live="polite"
                >
                  <span className="shrink-0 font-sans text-[10px] uppercase tracking-[0.14em] text-brass-text">
                    Line
                  </span>
                  <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {pathLine || 'Play or pick a move to start exploring.'}
                  </p>
                </div>
                <div className="flex justify-center rounded-[10px] border border-[#2b332c] bg-[#121511] p-1.5 shadow-inner-hairline xl:justify-end">
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

              <div className="flex min-h-0 flex-1 items-center justify-center py-1 lg:py-0">
                <div className="aspect-square w-full max-w-[min(100%,calc(100dvh-20rem))]">
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

              <p className="hidden shrink-0 text-center text-xs text-muted-foreground lg:block">
                Play on the board or pick from the explorer — save lines via{' '}
                <Link href="/openings" className="text-brass-text underline-offset-2 hover:underline">
                  My repertoire
                </Link>
                .
              </p>
            </main>

            <aside className="order-3 flex min-h-0 min-w-0 flex-col gap-3 lg:order-none lg:h-full lg:overflow-hidden">
              <OpeningExplorer fen={tree.fen} onMove={handleExplorerMove} className="shrink-0" />
              <GameRail
                title="Moves"
                className="min-h-0 flex-1"
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
            </aside>
          </div>
        )}
      </div>

      <PracticeFromFenDialog fen={tree.fen} open={practiceOpen} onClose={() => setPracticeOpen(false)} />
      {catalogOpen ? (
        <div className="fixed inset-0 z-50 bg-background/70 p-3 backdrop-blur-sm lg:hidden">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="opening-catalog-title"
            className="mx-auto flex h-[min(760px,calc(100dvh-1.5rem))] max-w-md flex-col overflow-hidden rounded-[12px] border border-border bg-surface shadow-elevated"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2.5">
              <div className="min-w-0">
                <h2
                  id="opening-catalog-title"
                  className="font-display text-lg italic text-foreground"
                >
                  Browse openings
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Search by name, ECO family, or variation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                aria-label="Close opening browser"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {renderCatalog('opening-lab-mobile-search')}
          </div>
        </div>
      ) : null}
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
