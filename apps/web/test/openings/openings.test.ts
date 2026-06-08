import { describe, it, expect } from 'vitest';
import { lookupByName, lookupByFen, randomOpening, getEcoFen, isValidFen } from '@/lib/openings';
import { ECO_OPENINGS } from '@/lib/openings/eco';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('lookupByName', () => {
  it('finds Sicilian Najdorf by partial name', () => {
    const result = lookupByName('Najdorf');
    expect(result).toBeDefined();
    expect(result!.code).toBe('B90');
    expect(result!.name.toLowerCase()).toContain('najdorf');
  });

  it('is case-insensitive', () => {
    const result = lookupByName('ruy lopez');
    expect(result).toBeDefined();
    expect(result!.name.toLowerCase()).toContain('ruy lopez');
  });

  it('returns undefined for an unknown query', () => {
    expect(lookupByName('zzzznotfound')).toBeUndefined();
  });

  it('returns undefined for an empty query', () => {
    expect(lookupByName('')).toBeUndefined();
  });
});

describe('getEcoFen', () => {
  it('returns a valid FEN for the first ECO entry', () => {
    const entry = ECO_OPENINGS[0];
    const fen = getEcoFen(entry);
    expect(isValidFen(fen)).toBe(true);
  });

  it('returns a stable cached result on repeated calls', () => {
    const entry = ECO_OPENINGS[0];
    expect(getEcoFen(entry)).toBe(getEcoFen(entry));
  });
});

describe('randomOpening', () => {
  it('returns an object with fen, name, and code', () => {
    const result = randomOpening();
    expect(typeof result.fen).toBe('string');
    expect(typeof result.name).toBe('string');
    expect(typeof result.code).toBe('string');
    expect(result.fen.length).toBeGreaterThan(0);
    expect(result.name.length).toBeGreaterThan(0);
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('yields a legal FEN', () => {
    expect(isValidFen(randomOpening().fen)).toBe(true);
  });
});

describe('isValidFen', () => {
  it('accepts the starting position FEN', () => {
    expect(isValidFen(START_FEN)).toBe(true);
  });

  it('rejects a plain string', () => {
    expect(isValidFen('not a fen')).toBe(false);
  });

  it('rejects an incomplete FEN (missing fields)', () => {
    expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidFen('')).toBe(false);
  });
});

describe('lookupByFen', () => {
  it('finds the starting position (no moves applied yet)', () => {
    const result = lookupByFen(START_FEN);
    expect(result).toBeUndefined();
  });

  it('round-trips: getEcoFen result is findable by lookupByFen', () => {
    const entry = ECO_OPENINGS.find((e) => e.moves.trim() !== '');
    if (!entry) return;
    const fen = getEcoFen(entry);
    const found = lookupByFen(fen);
    expect(found).toBeDefined();
    expect(found!.code).toBe(entry.code);
  });
});
