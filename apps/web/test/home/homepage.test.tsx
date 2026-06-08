import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/home/hero';
import { TrustStrip } from '@/components/home/trust-strip';
import { Footer } from '@/components/home/footer';

describe('Hero', () => {
  it('renders wordmark as h1', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1, name: /the board is/i })).toBeInTheDocument();
  });

  it('renders tagline', () => {
    render(<Hero />);
    expect(screen.getByText(/no puzzles, no lessons/i)).toBeInTheDocument();
  });

  it('Play now links to /play?mode=casual', () => {
    render(<Hero />);
    const link = screen.getByRole('link', { name: /play now/i });
    expect(link).toHaveAttribute('href', '/play?mode=casual');
  });

  it('Create account links to /register', () => {
    render(<Hero />);
    const link = screen.getByRole('link', { name: /create account/i });
    expect(link).toHaveAttribute('href', '/register');
  });

  it('Analyze CTA is disabled', () => {
    render(<Hero />);
    const btn = screen.getByRole('button', { name: /analyze a game/i });
    expect(btn).toBeDisabled();
  });
});

describe('TrustStrip', () => {
  it('renders all four trust statements', () => {
    render(<TrustStrip />);
    expect(screen.getByText('Fast matchmaking')).toBeInTheDocument();
    expect(screen.getByText('Clean board')).toBeInTheDocument();
    expect(screen.getByText('Free to start')).toBeInTheDocument();
    expect(screen.getByText('No distractions')).toBeInTheDocument();
  });
});

describe('Footer', () => {
  it('has About, Terms, Privacy links', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
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
    render(<Hero />);
    render(<TrustStrip />);
    render(<Footer />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
