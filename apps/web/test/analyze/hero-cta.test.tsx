import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/home/hero';

describe('Hero analyze CTA', () => {
  it('links to /analyze and is no longer gated behind "Soon"', () => {
    render(<Hero />);
    const link = screen.getByRole('link', { name: /analyze a game/i });
    expect(link).toHaveAttribute('href', '/analyze');
    expect(screen.queryByText(/soon/i)).toBeNull();
  });
});
