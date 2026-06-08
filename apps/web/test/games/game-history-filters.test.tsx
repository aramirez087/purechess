import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameHistoryFilters } from '@/components/games/game-history-filters';

const defaultProps = {
  isVsComputer: undefined as boolean | undefined,
  onVsComputerChange: vi.fn(),
};

describe('GameHistoryFilters', () => {
  it('category pills have aria-pressed', () => {
    render(
      <GameHistoryFilters
        category={undefined}
        isRated={undefined}
        onCategoryChange={vi.fn()}
        onRatedChange={vi.fn()}
        {...defaultProps}
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
        {...defaultProps}
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
        {...defaultProps}
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
        {...defaultProps}
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
        {...defaultProps}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rated' }));
    expect(onRatedChange).toHaveBeenCalledWith(true);
  });

  it('vs Computer pill fires onVsComputerChange with true', () => {
    const onVsComputerChange = vi.fn();
    render(
      <GameHistoryFilters
        category={undefined}
        isRated={undefined}
        isVsComputer={undefined}
        onCategoryChange={vi.fn()}
        onRatedChange={vi.fn()}
        onVsComputerChange={onVsComputerChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'vs Computer' }));
    expect(onVsComputerChange).toHaveBeenCalledWith(true);
  });

  it('vs Computer pill active when isVsComputer=true, click toggles off', () => {
    const onVsComputerChange = vi.fn();
    render(
      <GameHistoryFilters
        category={undefined}
        isRated={undefined}
        isVsComputer={true}
        onCategoryChange={vi.fn()}
        onRatedChange={vi.fn()}
        onVsComputerChange={onVsComputerChange}
      />,
    );
    const btn = screen.getByRole('button', { name: 'vs Computer' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(onVsComputerChange).toHaveBeenCalledWith(undefined);
  });
});
