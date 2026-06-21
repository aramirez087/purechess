import { describe, expect, it } from 'vitest';
import {
  displayOpeningLabel,
  normalizeOpeningLabel,
  openingLabelsMatch,
} from '@/lib/chess-com/opening-label';

describe('displayOpeningLabel', () => {
  it('resolves ECO codes to human names', () => {
    expect(displayOpeningLabel('C20')).toBe("King's Pawn Game");
  });

  it('passes through named openings', () => {
    expect(displayOpeningLabel('Italian Game')).toBe('Italian Game');
  });
});

describe('openingLabelsMatch', () => {
  it('matches ECO codes with their human names', () => {
    expect(openingLabelsMatch('C20', "King's Pawn Game")).toBe(true);
  });

  it('matches identical raw labels', () => {
    expect(openingLabelsMatch('Italian Game', 'Italian Game')).toBe(true);
  });
});

describe('normalizeOpeningLabel', () => {
  it('aliases displayOpeningLabel', () => {
    expect(normalizeOpeningLabel('C20')).toBe(displayOpeningLabel('C20'));
  });
});