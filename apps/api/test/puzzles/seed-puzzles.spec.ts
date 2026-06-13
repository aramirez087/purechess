import {
  parseRow,
  validateHeader,
  parseArgs,
  PopularityHeap,
  LICHESS_HEADER,
  type ParsedPuzzle,
} from '../../scripts/seed-puzzles';

/** Build a CSV data line in the exact lichess column order. */
function row(p: {
  id: string;
  fen?: string;
  moves?: string;
  rating?: string;
  rd?: string;
  pop?: string;
  plays?: string;
  themes?: string;
  url?: string;
  openings?: string;
}): string {
  return [
    p.id,
    p.fen ?? '8/8/8/8/8/8/8/K6k w - - 0 1',
    p.moves ?? 'e2e4 e7e5',
    p.rating ?? '1500',
    p.rd ?? '75',
    p.pop ?? '90',
    p.plays ?? '1000',
    p.themes ?? 'fork middlegame',
    p.url ?? 'https://lichess.org/abc',
    p.openings ?? 'Sicilian_Defense',
  ].join(',');
}

describe('validateHeader', () => {
  it('accepts the exact lichess header (with surrounding whitespace)', () => {
    expect(validateHeader(LICHESS_HEADER)).toBe(true);
    expect(validateHeader(`  ${LICHESS_HEADER}\r`)).toBe(true);
  });

  it('rejects a wrong/reordered header', () => {
    expect(validateHeader('Id,FEN,Moves')).toBe(false);
    expect(validateHeader('FEN,PuzzleId,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags')).toBe(
      false,
    );
  });
});

describe('parseRow', () => {
  it('splits moves/themes/openingTags on space and coerces ints', () => {
    const p = parseRow(
      row({
        id: 'AAA',
        moves: 'd2d4 g8f6 c2c4',
        rating: '1873',
        rd: '90',
        pop: '88',
        plays: '4210',
        themes: 'fork pin endgame',
        openings: 'Queens_Gambit Slav_Defense',
      }),
    );
    expect(p).not.toBeNull();
    const parsed = p as ParsedPuzzle;
    expect(parsed.id).toBe('AAA');
    expect(parsed.moves).toEqual(['d2d4', 'g8f6', 'c2c4']);
    expect(parsed.themes).toEqual(['fork', 'pin', 'endgame']);
    expect(parsed.openingTags).toEqual(['Queens_Gambit', 'Slav_Defense']);
    expect(parsed.rating).toBe(1873);
    expect(parsed.ratingDeviation).toBe(90);
    expect(parsed.popularity).toBe(88);
    expect(parsed.plays).toBe(4210);
  });

  it('defaults empty/garbage int cells to 0 and empty token cells to []', () => {
    const p = parseRow('BBB,8/8/8/8/8/8/8/K6k w - - 0 1,e2e4,,,,,,https://x,') as ParsedPuzzle;
    expect(p).not.toBeNull();
    expect(p.rating).toBe(0);
    expect(p.ratingDeviation).toBe(0);
    expect(p.popularity).toBe(0);
    expect(p.plays).toBe(0);
    expect(p.themes).toEqual([]);
    expect(p.openingTags).toEqual([]);
  });

  it('treats a missing OpeningTags column as no opening tags', () => {
    // 9 columns: no trailing OpeningTags cell at all.
    const line = 'CCC,8/8/8/8/8/8/8/K6k w - - 0 1,e2e4,1500,75,90,1000,fork,https://x';
    const p = parseRow(line) as ParsedPuzzle;
    expect(p).not.toBeNull();
    expect(p.openingTags).toEqual([]);
  });

  it('skips rows with empty FEN', () => {
    expect(parseRow('DDD,,e2e4,1500,75,90,1000,fork,https://x,')).toBeNull();
  });

  it('skips rows with empty Moves', () => {
    expect(parseRow('EEE,8/8/8/8/8/8/8/K6k w - - 0 1,,1500,75,90,1000,fork,https://x,')).toBeNull();
  });

  it('skips rows with empty PuzzleId', () => {
    expect(parseRow(',8/8/8/8/8/8/8/K6k w - - 0 1,e2e4,1500,75,90,1000,fork,https://x,')).toBeNull();
  });

  it('skips blank/short lines', () => {
    expect(parseRow('')).toBeNull();
    expect(parseRow('   ')).toBeNull();
    expect(parseRow('only,three,cols')).toBeNull();
  });
});

describe('PopularityHeap (top-N by popularity)', () => {
  function feed(lines: string[], capacity: number): ParsedPuzzle[] {
    const heap = new PopularityHeap(capacity);
    for (const line of lines) {
      const parsed = parseRow(line);
      if (parsed) heap.push(parsed);
    }
    return heap.toSortedDesc();
  }

  it('keeps exactly the top-N rows by popularity, dropping the rest', () => {
    const lines = [
      row({ id: 'p10', pop: '10' }),
      row({ id: 'p99', pop: '99' }),
      row({ id: 'p50', pop: '50' }),
      row({ id: 'p70', pop: '70' }),
      row({ id: 'p05', pop: '5' }),
    ];
    const kept = feed(lines, 3);
    expect(kept.map((k) => k.id)).toEqual(['p99', 'p70', 'p50']);
  });

  it('returns all rows (sorted) when N exceeds the input count', () => {
    const lines = [row({ id: 'a', pop: '40' }), row({ id: 'b', pop: '80' })];
    const kept = feed(lines, 10);
    expect(kept.map((k) => k.id)).toEqual(['b', 'a']);
    expect(kept).toHaveLength(2);
  });

  it('breaks popularity ties by plays (higher plays wins)', () => {
    const lines = [
      row({ id: 'lowPlays', pop: '88', plays: '10' }),
      row({ id: 'highPlays', pop: '88', plays: '9000' }),
      row({ id: 'midPlays', pop: '88', plays: '500' }),
    ];
    const kept = feed(lines, 2);
    expect(kept.map((k) => k.id)).toEqual(['highPlays', 'midPlays']);
  });

  it('maintains O(capacity) memory — heap size never exceeds capacity', () => {
    const heap = new PopularityHeap(2);
    for (let i = 0; i < 100; i++) {
      const parsed = parseRow(row({ id: `p${i}`, pop: String(i) }));
      if (parsed) heap.push(parsed);
      expect(heap.size).toBeLessThanOrEqual(2);
    }
    const kept = heap.toSortedDesc();
    expect(kept.map((k) => k.id)).toEqual(['p99', 'p98']);
  });

  it('rejects a capacity < 1', () => {
    expect(() => new PopularityHeap(0)).toThrow();
  });
});

describe('parseArgs', () => {
  it('parses path + --count + --min-popularity (space form)', () => {
    const o = parseArgs(['./dump.csv', '--count', '5000', '--min-popularity', '80']);
    expect(o.filePath).toBe('./dump.csv');
    expect(o.count).toBe(5000);
    expect(o.minPopularity).toBe(80);
  });

  it('parses the --flag=value form', () => {
    const o = parseArgs(['--count=1000', './x.csv', '--min-popularity=50']);
    expect(o.filePath).toBe('./x.csv');
    expect(o.count).toBe(1000);
    expect(o.minPopularity).toBe(50);
  });

  it('defaults count to 50000 and min-popularity to -Infinity', () => {
    const o = parseArgs(['./x.csv']);
    expect(o.count).toBe(50000);
    expect(o.minPopularity).toBe(Number.NEGATIVE_INFINITY);
  });

  it('throws with a runbook hint when no path is given', () => {
    expect(() => parseArgs(['--count', '100'])).toThrow(/puzzle-db-refresh\.md/);
  });

  it('throws on a non-positive count', () => {
    expect(() => parseArgs(['./x.csv', '--count', '0'])).toThrow(/--count/);
  });
});
