import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RatingChart } from '@/components/profile/rating-chart';
import type { RatingHistoryPoint } from '@purechess/shared';

const DAY_MS = 86_400_000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function point(overrides: Partial<RatingHistoryPoint> = {}): RatingHistoryPoint {
  return {
    ratingAfter: 1500,
    ratingDelta: 10,
    gameId: null,
    playedAt: daysAgo(1),
    category: 'blitz',
    ...overrides,
  };
}

describe('RatingChart', () => {
  it('renders empty state when fewer than 2 points', () => {
    render(<RatingChart history={[point()]} />);
    expect(screen.getByText(/not enough games yet/i)).toBeTruthy();
  });

  it('renders correct number of dots for filtered data', () => {
    const history = [
      point({ ratingAfter: 1500, playedAt: daysAgo(3) }),
      point({ ratingAfter: 1512, playedAt: daysAgo(2) }),
      point({ ratingAfter: 1505, playedAt: daysAgo(1), ratingDelta: -7 }),
      // different category — must not render on the blitz chart
      point({ category: 'rapid', playedAt: daysAgo(1) }),
      point({ category: 'rapid', playedAt: daysAgo(2) }),
    ];
    const { container } = render(<RatingChart history={history} />);
    expect(container.querySelectorAll('[data-testid="rating-dot"]').length).toBe(3);
  });

  it("time range filter: '1m' excludes old points", () => {
    const history = [
      point({ playedAt: daysAgo(100) }),
      point({ playedAt: daysAgo(5) }),
      point({ playedAt: daysAgo(2) }),
    ];
    const { container } = render(<RatingChart history={history} />);
    expect(container.querySelectorAll('[data-testid="rating-dot"]').length).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: '1m' }));
    expect(container.querySelectorAll('[data-testid="rating-dot"]').length).toBe(2);
  });

  it('hides category tab when that category has no data', () => {
    const history = [point({ playedAt: daysAgo(2) }), point({ playedAt: daysAgo(1) })];
    render(<RatingChart history={history} />);
    expect(screen.getByRole('tab', { name: 'Blitz' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Bullet' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Rapid' })).toBeNull();
  });

  it('tooltip renders with gameId link when gameId is present', () => {
    const history = [
      point({ playedAt: daysAgo(2) }),
      point({ playedAt: daysAgo(1), gameId: 'game-42', ratingDelta: 24, ratingAfter: 1847 }),
    ];
    const { container } = render(<RatingChart history={history} />);
    const hits = container.querySelectorAll('[data-testid="rating-hit"]');
    fireEvent.pointerOver(hits[1]);

    expect(screen.getByText('+24 pts')).toBeTruthy();
    expect(screen.getByText('→ 1847')).toBeTruthy();
    const link = screen.getByRole('link', { name: /view game/i });
    expect(link.getAttribute('href')).toBe('/games/game-42');
  });

  it('omits the game link when gameId is null', () => {
    const history = [
      point({ playedAt: daysAgo(2) }),
      point({ playedAt: daysAgo(1), gameId: null }),
    ];
    const { container } = render(<RatingChart history={history} />);
    const hits = container.querySelectorAll('[data-testid="rating-hit"]');
    fireEvent.pointerOver(hits[1]);

    expect(screen.getByText(/pts/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /view game/i })).toBeNull();
  });

  it('defaults to the category with the most points', () => {
    const history = [
      point({ category: 'blitz', playedAt: daysAgo(3) }),
      point({ category: 'rapid', playedAt: daysAgo(3) }),
      point({ category: 'rapid', playedAt: daysAgo(2) }),
      point({ category: 'rapid', playedAt: daysAgo(1) }),
    ];
    render(<RatingChart history={history} />);
    expect(screen.getByRole('tab', { name: 'Rapid' }).getAttribute('aria-selected')).toBe('true');
  });
});
