import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpeningsSubNav } from '@/components/openings/openings-sub-nav';

const usePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));

describe('OpeningsSubNav', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/openings');
  });

  it('links repertoire and opening lab', () => {
    render(<OpeningsSubNav />);
    expect(screen.getByRole('link', { name: 'Repertoire' })).toHaveAttribute('href', '/openings');
    expect(screen.getByRole('link', { name: 'Opening Lab' })).toHaveAttribute(
      'href',
      '/openings/lab',
    );
    expect(screen.getByRole('link', { name: /all training/i })).toHaveAttribute('href', '/train');
  });

  it('marks opening lab active under /openings/lab', () => {
    usePathname.mockReturnValue('/openings/lab/drill');
    render(<OpeningsSubNav />);
    expect(screen.getByRole('link', { name: 'Opening Lab' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Repertoire' })).not.toHaveAttribute('aria-current');
  });
});