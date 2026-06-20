import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PuzzleSubNav } from '@/components/puzzle/puzzle-sub-nav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/puzzles/train',
}));

describe('PuzzleSubNav', () => {
  it('renders all puzzle mode links and marks the active route', () => {
    render(<PuzzleSubNav />);

    expect(screen.getByRole('link', { name: 'Daily' })).toHaveAttribute('href', '/puzzles');
    expect(screen.getByRole('link', { name: 'Train' })).toHaveAttribute('href', '/puzzles/train');
    expect(screen.getByRole('link', { name: 'Rush' })).toHaveAttribute('href', '/puzzles/rush');
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/puzzles/review');
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/puzzles/stats');
    expect(screen.getByRole('link', { name: 'All training →' })).toHaveAttribute('href', '/train');

    expect(screen.getByRole('link', { name: 'Train' })).toHaveAttribute('aria-current', 'page');
  });
});