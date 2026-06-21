import { describe, expect, it } from 'vitest';
import type { RepertoireSummaryDto } from '@purechess/shared';
import {
  openingLabHref,
  parseOpeningActionHref,
  resolveOpeningDeepLink,
} from '@/lib/openings/opening-deep-link';

function rep(
  partial: Partial<RepertoireSummaryDto> & Pick<RepertoireSummaryDto, 'id' | 'name'>,
): RepertoireSummaryDto {
  return {
    color: 'white',
    rootFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    lineCount: 3,
    nodeCount: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('parseOpeningActionHref', () => {
  it('reads repertoire deep links', () => {
    expect(parseOpeningActionHref('/openings?repertoire=rep-1')).toEqual({
      kind: 'repertoire',
      id: 'rep-1',
    });
  });

  it('reads chess.com opening deep links', () => {
    expect(parseOpeningActionHref('/openings?chesscom=Italian%20Game')).toEqual({
      kind: 'chesscom',
      label: 'Italian Game',
    });
  });

  it('reads legacy Opening Lab deep links', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
    expect(
      parseOpeningActionHref(`/openings/lab?q=C20&fen=${encodeURIComponent(fen)}`),
    ).toEqual({
      kind: 'lab',
      query: 'C20',
      fen,
    });
  });

  it('falls back to hub for bare /openings', () => {
    expect(parseOpeningActionHref('/openings')).toEqual({ kind: 'hub' });
  });
});

describe('openingLabHref', () => {
  it('resolves ECO codes in the query param', () => {
    const href = openingLabHref('C20');
    expect(href).toContain("q=King");
    expect(href).toContain("Pawn+Game");
  });
});

describe('resolveOpeningDeepLink', () => {
  const repertoires = [
    rep({ id: 'italian', name: 'Italian Game', lineCount: 4 }),
    rep({ id: 'empty', name: 'Empty rep', lineCount: 0, nodeCount: 0 }),
  ];

  it('starts a drill when the repertoire has lines', () => {
    expect(
      resolveOpeningDeepLink({ kind: 'repertoire', id: 'italian' }, repertoires),
    ).toEqual({
      kind: 'drill',
      repertoireId: 'italian',
      name: 'Italian Game',
    });
  });

  it('opens an empty repertoire for editing when it has no lines', () => {
    expect(
      resolveOpeningDeepLink({ kind: 'repertoire', id: 'empty' }, repertoires),
    ).toEqual({
      kind: 'read',
      repertoireId: 'empty',
    });
  });

  it('drills a matching repertoire for chess.com opening mistakes', () => {
    expect(
      resolveOpeningDeepLink({ kind: 'chesscom', label: 'Italian Game' }, repertoires),
    ).toEqual({
      kind: 'drill',
      repertoireId: 'italian',
      name: 'Italian Game',
    });
  });

  it('routes chess.com mistakes to coach review instead of Opening Lab', () => {
    expect(
      resolveOpeningDeepLink({ kind: 'chesscom', label: 'C20' }, repertoires),
    ).toEqual({
      kind: 'review-mistakes',
      label: 'C20',
    });
  });

  it('treats legacy lab links as mistake review', () => {
    expect(
      resolveOpeningDeepLink({ kind: 'lab', query: 'C20' }, repertoires),
    ).toEqual({
      kind: 'review-mistakes',
      label: 'C20',
    });
  });
});