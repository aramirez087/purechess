// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { formatGames, OpeningExplorer } from '@/components/review/opening-explorer';
import type { ExplorerMove, ExplorerResult } from '@/hooks/use-opening-explorer';

const useOpeningExplorerMock = vi.fn();
vi.mock('@/hooks/use-opening-explorer', () => ({
  useOpeningExplorer: (...args: unknown[]) => useOpeningExplorerMock(...args),
}));

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function move(partial: Partial<ExplorerMove>): ExplorerMove {
  return {
    uci: 'e2e4',
    san: 'e4',
    white: 50,
    draws: 30,
    black: 20,
    total: 100,
    whitePercent: 50,
    drawPercent: 30,
    blackPercent: 20,
    averageRating: 1800,
    ...partial,
  };
}

function inBookResult(moves: ExplorerMove[]): { data: ExplorerResult; loading: boolean } {
  return { data: { moves, inBook: true, source: 'lichess' }, loading: false };
}

const THREE_MOVES = [
  move({ uci: 'e2e4', san: 'e4', total: 18432 }),
  move({ uci: 'd2d4', san: 'd4', total: 8100 }),
  move({ uci: 'g1f3', san: 'Nf3', total: 950 }),
];

describe('formatGames', () => {
  it('abbreviates thousands and keeps small counts raw', () => {
    expect(formatGames(18432)).toBe('18k');
    expect(formatGames(1000)).toBe('1k');
    expect(formatGames(950)).toBe('950');
  });
});

describe('OpeningExplorer', () => {
  beforeEach(() => {
    useOpeningExplorerMock.mockReset();
  });

  it('renders null when out of book', () => {
    useOpeningExplorerMock.mockReturnValue({
      data: { moves: [], inBook: false, source: 'lichess' },
      loading: false,
    });
    const { container } = render(<OpeningExplorer fen={FEN} onMove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null before any data when not loading', () => {
    useOpeningExplorerMock.mockReturnValue({ data: null, loading: false });
    const { container } = render(<OpeningExplorer fen={FEN} onMove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per move when in book', () => {
    useOpeningExplorerMock.mockReturnValue(inBookResult(THREE_MOVES));
    render(<OpeningExplorer fen={FEN} onMove={() => {}} />);
    expect(screen.getByText('e4')).toBeDefined();
    expect(screen.getByText('d4')).toBeDefined();
    expect(screen.getByText('Nf3')).toBeDefined();
    // 2 source pills + 3 move rows.
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByText('18k')).toBeDefined();
    expect(screen.getByText('950')).toBeDefined();
  });

  it('clicking a row calls onMove with the UCI move', () => {
    const onMove = vi.fn();
    useOpeningExplorerMock.mockReturnValue(inBookResult(THREE_MOVES));
    render(<OpeningExplorer fen={FEN} onMove={onMove} />);
    fireEvent.click(screen.getByRole('button', { name: /Nf3/ }));
    expect(onMove).toHaveBeenCalledWith('g1f3');
  });

  it('source toggle switches the hook between lichess and masters', () => {
    useOpeningExplorerMock.mockReturnValue(inBookResult(THREE_MOVES));
    render(<OpeningExplorer fen={FEN} onMove={() => {}} />);
    expect(useOpeningExplorerMock).toHaveBeenLastCalledWith(FEN, 'lichess');

    fireEvent.click(screen.getByRole('button', { name: 'Masters' }));
    expect(useOpeningExplorerMock).toHaveBeenLastCalledWith(FEN, 'masters');
    expect(screen.getByRole('button', { name: 'Masters' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lichess' }));
    expect(useOpeningExplorerMock).toHaveBeenLastCalledWith(FEN, 'lichess');
  });

  it('shows skeleton rows while loading with no data yet', () => {
    useOpeningExplorerMock.mockReturnValue({ data: null, loading: true });
    const { container } = render(<OpeningExplorer fen={FEN} onMove={() => {}} />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
    // Only the source pills are interactive.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
