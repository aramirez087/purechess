import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero } from '@/components/home/hero';

vi.mock('@/lib/api/auth', () => ({
  getMe: vi.fn().mockResolvedValue({ user: null }),
}));

function renderHero() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Hero />
    </QueryClientProvider>,
  );
}

describe('Hero primary CTAs', () => {
  it('exposes quick play and improve-surface entry points', () => {
    renderHero();
    expect(screen.getByRole('link', { name: /play now/i })).toHaveAttribute('href', '/play/quick');
    expect(screen.getByRole('link', { name: /daily puzzle/i })).toHaveAttribute('href', '/puzzles');
    expect(screen.getByRole('link', { name: /^train$/i })).toHaveAttribute('href', '/train');
    expect(screen.queryByText(/soon/i)).toBeNull();
  });
});