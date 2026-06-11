import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GameHistorySummaryDto } from '@purechess/shared';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

vi.mock('@/hooks/use-game-history', () => ({
  useGameHistory: vi.fn(),
}));

import { useGameHistory } from '@/hooks/use-game-history';
import { GamesClient } from '@/app/games/games-client';

type MockReturn = Partial<ReturnType<typeof useGameHistory>>;

const mockGame: GameHistorySummaryDto = {
  id: 'g1',
  opponentUsername: 'bob',
  playedAs: 'white',
  result: 'win',
  ratingDelta: 10,
  category: 'blitz',
  timeControlSeconds: 300,
  incrementSeconds: 0,
  isRated: true,
  isVsComputer: false,
  endedAt: '2024-04-01T12:00:00Z',
};

function mockHook(partial: MockReturn) {
  vi.mocked(useGameHistory).mockReturnValue(partial as ReturnType<typeof useGameHistory>);
}

beforeEach(() => {
  mockHook({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  });
});

describe('GamesClient', () => {
  it('shows empty state with no games and no filters', () => {
    mockHook({
      data: { pages: [{ games: [], nextCursor: null }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByText(/no games recorded/i)).toBeTruthy();
  });

  it('shows filter empty state when filters active but no results', () => {
    mockHook({
      data: { pages: [{ games: [], nextCursor: null }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" initialCategory="bullet" />);
    expect(screen.getByText(/nothing matches this filter/i)).toBeTruthy();
  });

  it('shows Load more button when nextCursor exists', () => {
    mockHook({
      data: { pages: [{ games: [mockGame], nextCursor: 'cursor-abc' }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByRole('button', { name: /load older games/i })).toBeTruthy();
  });

  it('renders game rows', () => {
    mockHook({
      data: { pages: [{ games: [mockGame], nextCursor: null }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByText('bob')).toBeTruthy();
  });

  it('footer shows the API total and labels the tally as partial when more pages remain', () => {
    mockHook({
      data: {
        pages: [{ games: [mockGame], nextCursor: 'cursor-abc', total: 42 }],
        pageParams: [undefined],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByText('42 games')).toBeTruthy();
    expect(screen.getByText(/latest 1: 1W–0L–0D/)).toBeTruthy();
  });

  it('footer falls back to loaded count when the API total is absent', () => {
    mockHook({
      data: {
        pages: [{ games: [mockGame], nextCursor: 'cursor-abc' }],
        pageParams: [undefined],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByText('1 game shown')).toBeTruthy();
  });

  it('footer tally is unlabelled when all games are loaded', () => {
    mockHook({
      data: {
        pages: [{ games: [mockGame], nextCursor: null, total: 1 }],
        pageParams: [undefined],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByText('1 game')).toBeTruthy();
    expect(screen.getByText('1W–0L–0D')).toBeTruthy();
    expect(screen.queryByText(/latest/)).toBeNull();
  });

  it('Review column header has an sr-only accessible label inside a th', () => {
    mockHook({
      data: { pages: [{ games: [mockGame], nextCursor: null }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    const srSpans = screen.getAllByText('Review');
    const srOnly = srSpans.find((el) => el.className === 'sr-only');
    expect(srOnly).toBeTruthy();
  });

  it('color swatch aria-label describes piece color as "Played as white"', () => {
    mockHook({
      data: { pages: [{ games: [mockGame], nextCursor: null }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    const swatch = screen.getByRole('img', { name: 'Played as white' });
    expect(swatch).toBeTruthy();
  });
});
