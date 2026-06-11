import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroAuthLink } from '@/components/home/hero-auth-link';
import { getMe } from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getMe: vi.fn(),
}));

const mockGetMe = vi.mocked(getMe);
type Me = Awaited<ReturnType<typeof getMe>>;

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockGetMe.mockReset();
});

describe('HeroAuthLink', () => {
  it('anonymous: renders Sign in → /login and keeps it after the session resolves', async () => {
    mockGetMe.mockResolvedValue({ user: null });
    renderWithClient(<HeroAuthLink />);

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    await waitFor(() => expect(mockGetMe).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /your games/i })).not.toBeInTheDocument();
  });

  it('signed in: defaults to the signed-out markup, then swaps to Your games → /games', async () => {
    mockGetMe.mockResolvedValue({
      user: { id: 'u1', username: 'alex' },
    } as unknown as Me);
    renderWithClient(<HeroAuthLink />);

    // No layout shift while loading: signed-out markup first.
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();

    const link = await screen.findByRole('link', { name: /your games/i });
    expect(link).toHaveAttribute('href', '/games');
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('session lookup failure: falls back to the signed-out link', async () => {
    mockGetMe.mockRejectedValue(new Error('network down'));
    renderWithClient(<HeroAuthLink />);

    await waitFor(() => expect(mockGetMe).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
