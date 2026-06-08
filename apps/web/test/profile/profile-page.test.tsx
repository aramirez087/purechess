import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileHeader } from '@/components/profile/profile-header';
import { RatingsCard } from '@/components/profile/ratings-card';
import { StatsCard } from '@/components/profile/stats-card';
import { RecentGames } from '@/components/profile/recent-games';
import type { RatingDto, StatsDto, GameHistorySummaryDto } from '@purechess/shared';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockRatings: RatingDto[] = [
  { category: 'bullet', rating: 1600, gamesPlayed: 42 },
  { category: 'blitz', rating: 1750, gamesPlayed: 120 },
  { category: 'rapid', rating: 1800, gamesPlayed: 30 },
];

const mockStats: StatsDto = {
  totalGames: 192,
  wins: 100,
  losses: 72,
  draws: 20,
  winRate: 52.1,
};

const mockGame: GameHistorySummaryDto = {
  id: 'game-1',
  opponentUsername: 'bobby',
  playedAs: 'white',
  result: 'win',
  ratingDelta: 12,
  category: 'blitz',
  timeControlSeconds: 300,
  incrementSeconds: 0,
  isRated: true,
  isVsComputer: false,
  endedAt: '2024-03-15T10:00:00Z',
};

describe('ProfileHeader', () => {
  it('renders username and join date', () => {
    render(
      <ProfileHeader
        username="alice"
        avatarUrl={null}
        createdAt="2024-03-01T00:00:00Z"
        isOwnProfile={false}
      />,
    );
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText(/Joined/)).toBeTruthy();
  });

  it('shows Edit profile button for own profile', () => {
    render(
      <ProfileHeader
        username="alice"
        avatarUrl={null}
        createdAt="2024-03-01T00:00:00Z"
        isOwnProfile={true}
      />,
    );
    expect(screen.getByRole('button', { name: /edit profile/i })).toBeTruthy();
  });

  it('hides Edit profile button on other profile', () => {
    render(
      <ProfileHeader
        username="bob"
        avatarUrl={null}
        createdAt="2024-03-01T00:00:00Z"
        isOwnProfile={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /edit profile/i })).toBeNull();
  });
});

describe('RatingsCard', () => {
  it('renders Bullet, Blitz, Rapid ratings', () => {
    render(<RatingsCard ratings={mockRatings} />);
    expect(screen.getByText('Bullet')).toBeTruthy();
    expect(screen.getByText('Blitz')).toBeTruthy();
    expect(screen.getByText('Rapid')).toBeTruthy();
    expect(screen.getByText('1600')).toBeTruthy();
    expect(screen.getByText('1750')).toBeTruthy();
    expect(screen.getByText('1800')).toBeTruthy();
  });

  it('shows default 1500 when category missing', () => {
    render(<RatingsCard ratings={[]} />);
    const cells = screen.getAllByText('1500');
    expect(cells.length).toBe(3);
  });
});

describe('StatsCard', () => {
  it('renders win rate with one decimal', () => {
    render(<StatsCard stats={mockStats} />);
    expect(screen.getByText('52.1%')).toBeTruthy();
  });

  it('renders total games, wins, losses, draws', () => {
    render(<StatsCard stats={mockStats} />);
    expect(screen.getByText('192')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });
});

describe('RecentGames', () => {
  it('renders list of games', () => {
    render(<RecentGames games={[mockGame]} />);
    expect(screen.getByText('bobby')).toBeTruthy();
    expect(screen.getByText('Win')).toBeTruthy();
  });

  it('shows empty state when no games', () => {
    render(<RecentGames games={[]} />);
    expect(screen.getByText(/No recent games/i)).toBeTruthy();
  });

  it('links each row to /games/:id', () => {
    render(<RecentGames games={[mockGame]} />);
    const links = screen.getAllByRole('link');
    const gameLink = links.find((l) => l.getAttribute('href') === '/games/game-1');
    expect(gameLink).toBeDefined();
  });
});
