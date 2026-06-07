import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameHistoryFilters } from '@/components/games/game-history-filters';

describe('GameHistoryFilters', () => {
  it('category pills have aria-pressed', () => {
    render(
      <GameHistoryFilters
        category={undefined}
        isRated={undefined}
        onCategoryChange={vi.fn()}
        onRatedChange={vi.fn()}
      />,
    );
    const allButtons = screen.getAllByRole('button');
    for (const btn of allButtons) {
      expect(btn.hasAttribute('aria-pressed')).toBe(true);
    }
  });

  it('active category pill has aria-pressed=true', () => {
    render(
      <GameHistoryFilters
        category="blitz"
        isRated={undefined}
        onCategoryChange={vi.fn()}
        onRatedChange={vi.fn()}
      />,
    );
    const blitzBtn = screen.getByRole('button', { name: 'Blitz' });
    expect(blitzBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking inactive category fires onCategoryChange', () => {
    const onCategoryChange = vi.fn();
    render(
      <GameHistoryFilters
        category={undefined}
        isRated={undefined}
        onCategoryChange={onCategoryChange}
        onRatedChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bullet' }));
    expect(onCategoryChange).toHaveBeenCalledWith('bullet');
  });

  it('clicking active category toggles it off', () => {
    const onCategoryChange = vi.fn();
    render(
      <GameHistoryFilters
        category="bullet"
        isRated={undefined}
        onCategoryChange={onCategoryChange}
        onRatedChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bullet' }));
    expect(onCategoryChange).toHaveBeenCalledWith(undefined);
  });

  it('rated pill fires onRatedChange with boolean', () => {
    const onRatedChange = vi.fn();
    render(
      <GameHistoryFilters
        category={undefined}
        isRated={undefined}
        onCategoryChange={vi.fn()}
        onRatedChange={onRatedChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rated' }));
    expect(onRatedChange).toHaveBeenCalledWith(true);
  });
});
