import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero } from '@/components/home/hero';

// Hero contains HeroAuthLink (useQuery) — give it a client and a quiet getMe.
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

describe('Hero analyze CTA', () => {
  it('links to /analyze and is no longer gated behind "Soon"', () => {
    renderHero();
    const link = screen.getByRole('link', { name: /analyze a game/i });
    expect(link).toHaveAttribute('href', '/analyze');
    expect(screen.queryByText(/soon/i)).toBeNull();
  });
});
