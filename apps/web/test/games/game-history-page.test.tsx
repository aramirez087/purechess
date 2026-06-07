import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GameHistorySummaryDto } from '@purchess/shared';

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
    expect(screen.getByText(/haven't played any games yet/i)).toBeTruthy();
  });

  it('shows filter empty state when filters active but no results', () => {
    mockHook({
      data: { pages: [{ games: [], nextCursor: null }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" initialCategory="bullet" />);
    expect(screen.getByText(/no games match these filters/i)).toBeTruthy();
  });

  it('shows Load more button when nextCursor exists', () => {
    mockHook({
      data: { pages: [{ games: [mockGame], nextCursor: 'cursor-abc' }], pageParams: [undefined] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    render(<GamesClient username="alice" />);
    expect(screen.getByRole('button', { name: /load more/i })).toBeTruthy();
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
});
