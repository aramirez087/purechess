import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hero } from '@/components/home/hero';
import { TrustStrip } from '@/components/home/trust-strip';
import { Footer } from '@/components/home/footer';

// Hero contains the session-aware HeroAuthLink — keep /api/auth/me off the
// network in unit tests (anonymous by default).
vi.mock('@/lib/api/auth', () => ({
  getMe: vi.fn().mockResolvedValue({ user: null }),
}));

vi.mock('@/lib/api/computer-games', () => ({
  createComputerGame: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Hero', () => {
  it('renders wordmark as h1', () => {
    renderWithClient(<Hero />);
    expect(screen.getByRole('heading', { level: 1, name: /the board is/i })).toBeInTheDocument();
  });

  it('renders tagline', () => {
    renderWithClient(<Hero />);
    expect(screen.getByText(/single, quiet place to play chess online/i)).toBeInTheDocument();
  });

  it('Analyze links to /analyze', () => {
    renderWithClient(<Hero />);
    const link = screen.getByRole('link', { name: /analyze/i });
    expect(link).toHaveAttribute('href', '/analyze');
  });

  it('Play computer starts from the hero', () => {
    renderWithClient(<Hero />);
    expect(screen.getByRole('button', { name: /start a computer game/i })).toBeInTheDocument();
  });

  it('Daily puzzle links to /puzzles', () => {
    renderWithClient(<Hero />);
    const link = screen.getByRole('link', { name: /daily puzzle/i });
    expect(link).toHaveAttribute('href', '/puzzles');
  });

  it('Train links to /train', () => {
    renderWithClient(<Hero />);
    const link = screen.getByRole('link', { name: /^train$/i });
    expect(link).toHaveAttribute('href', '/train');
  });

  it('defaults to the signed-out Sign in link', () => {
    renderWithClient(<Hero />);
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});

describe('TrustStrip', () => {
  it('renders all four trust statements', () => {
    render(<TrustStrip />);
    expect(screen.getByText('Fast matchmaking')).toBeInTheDocument();
    expect(screen.getByText('Clean board')).toBeInTheDocument();
    expect(screen.getByText('No ads, ever')).toBeInTheDocument();
    expect(screen.getByText('No distractions')).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('has primary destination links', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /play/i })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: /train/i })).toHaveAttribute('href', '/train');
    expect(screen.getByRole('link', { name: /openings/i })).toHaveAttribute('href', '/openings');
    expect(screen.getByRole('link', { name: /puzzles/i })).toHaveAttribute('href', '/puzzles');
    expect(screen.getByRole('link', { name: /analyze/i })).toHaveAttribute('href', '/analyze');
  });

  it('shows Purechess wordmark in footer', () => {
    render(<Footer />);
    const matches = screen.getAllByText(/purechess/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('No analytics in dev', () => {
  it('does not call fetch during static render', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderWithClient(<Hero />);
    render(<TrustStrip />);
    render(<Footer />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
