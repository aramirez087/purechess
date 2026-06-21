import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero } from '@/components/home/hero';

vi.mock('@/lib/api/auth', () => ({
  getMe: vi.fn().mockResolvedValue({ user: null }),
}));

vi.mock('@/lib/api/computer-games', () => ({
  createComputerGame: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
    expect(screen.getByRole('link', { name: /analyze/i })).toHaveAttribute('href', '/analyze');
    expect(screen.getByRole('button', { name: /start a computer game/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /daily puzzle/i })).toHaveAttribute('href', '/puzzles');
    expect(screen.getByRole('link', { name: /^train$/i })).toHaveAttribute('href', '/train');
    expect(screen.queryByText(/soon/i)).toBeNull();
  });
});
