import { describe, it, expect } from 'vitest';
import {
  buildOpeningBook,
  epdToStudyFen,
  findOpeningForLabel,
  getFamily,
  openingLabelSearchQueries,
  parseOpeningEntry,
  searchOpenings,
} from '@/lib/openings/opening-book';

const SAMPLE: Array<[string, string, string]> = [
  ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'Italian Game', '1. e4 e5 2. Nf3 Nc6 3. Bc4'],
  [
    'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
    'Italian Game: Giuoco Piano',
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
  ],
  [
    'r1bq1b1r/ppn3pp/2p1k3/3np3/2BPQ3/P1N5/1PP2PPP/R1B1K2R w KQ -',
    'Italian Game: Two Knights Defense, Fegatello Attack, Leonhardt Variation',
    '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5',
  ],
  ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -', "King's Pawn Game", '1. e4'],
];

describe('opening-book', () => {
  it('epdToStudyFen appends counters', () => {
    expect(epdToStudyFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });

  it('parseOpeningEntry splits family and variation', () => {
    const entry = parseOpeningEntry(SAMPLE[2]);
    expect(entry.family).toBe('Italian Game');
    expect(entry.variation).toContain('Fegatello');
    expect(entry.fen).toContain(' 0 1');
    expect(entry.pgn).toContain('Ng5');
  });

  it('buildOpeningBook groups by family and sorts by size', () => {
    const book = buildOpeningBook(SAMPLE);
    expect(book.families[0].name).toBe('Italian Game');
    expect(book.families[0].entries).toHaveLength(3);
    expect(getFamily(book, 'Italian Game')?.entries).toHaveLength(3);
  });

  it('searchOpenings finds Fegatello and ranks exact variation hits', () => {
    const book = buildOpeningBook(SAMPLE);
    const hits = searchOpenings(book, 'fegatello');
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toContain('Fegatello');
  });

  it('searchOpenings matches family names', () => {
    const book = buildOpeningBook(SAMPLE);
    const hits = searchOpenings(book, 'italian');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.every((h) => h.family === 'Italian Game')).toBe(true);
  });

  it('openingLabelSearchQueries normalizes ECO comma labels', () => {
    const queries = openingLabelSearchQueries('Italian Game, Giuoco Piano');
    expect(queries).toContain('Italian Game, Giuoco Piano');
    expect(queries).toContain('Italian Game: Giuoco Piano');
    expect(queries).toContain('Italian Game');
  });

  it('findOpeningForLabel resolves comma-style ECO names against the lichess book', () => {
    const book = buildOpeningBook(SAMPLE);
    const hit = findOpeningForLabel(book, 'Italian Game, Giuoco Piano');
    expect(hit?.name).toBe('Italian Game: Giuoco Piano');
  });

  it('findOpeningForLabel can pin by mistake FEN', () => {
    const book = buildOpeningBook(SAMPLE);
    const hit = findOpeningForLabel(
      book,
      'unknown label',
      'r1bq1b1r/ppn3pp/2p1k3/3np3/2BPQ3/P1N5/1PP2PPP/R1B1K2R w KQ - 0 1',
    );
    expect(hit?.name).toContain('Fegatello');
  });
});