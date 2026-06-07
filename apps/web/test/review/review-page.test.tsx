import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReviewClient } from '@/app/games/[gameId]/review-client';
import { GameResult, GameTermination, TimeCategory } from '@purchess/shared';
import type { GameReview } from '@/types/game-review';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/board', () => ({
  Chessboard: ({ position }: { position: string }) => (
    <div data-testid="chessboard" data-position={position} />
  ),
}));

const MOCK_MOVES = [
  { ply: 1, san: 'e4', uci: 'e2e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', clockAfterMs: 180000, moveTimeMs: 1000, by: 'w' as const },
  { ply: 2, san: 'e5', uci: 'e7e5', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', clockAfterMs: 180000, moveTimeMs: 1000, by: 'b' as const },
  { ply: 3, san: 'Nf3', uci: 'g1f3', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', clockAfterMs: 179000, moveTimeMs: 1000, by: 'w' as const },
  { ply: 4, san: 'Nc6', uci: 'b8c6', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', clockAfterMs: 179500, moveTimeMs: 500, by: 'b' as const },
  { ply: 5, san: 'Bb5', uci: 'f1b5', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', clockAfterMs: 178000, moveTimeMs: 1000, by: 'w' as const },
  { ply: 6, san: 'a6', uci: 'a7a6', fenAfter: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', clockAfterMs: 178500, moveTimeMs: 1000, by: 'b' as const },
];

const FINAL_FEN = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';

const MOCK_GAME: GameReview = {
  id: 'test-game-001',
  white: { id: 'u1', username: 'Alice', rating: 1500 },
  black: { id: 'u2', username: 'Bob', rating: 1480 },
  moves: MOCK_MOVES,
  finalFen: FINAL_FEN,
  pgn: '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0',
  result: GameResult.WhiteWins,
  termination: GameTermination.Resignation,
  timeControl: { initialSeconds: 180, incrementSeconds: 0, category: TimeCategory.Blitz, label: '3 min' },
  rated: true,
  startedAt: '2026-06-01T12:00:00.000Z',
};

const CORRUPT_GAME: GameReview = {
  ...MOCK_GAME,
  finalFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
};

describe('ReviewClient', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  it('renders board at ply 0 (starting position)', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('rnbqkbnr/pppppppp');
  });

  it('Next button advances currentPly', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    const nextBtn = screen.getByLabelText('Next move');
    fireEvent.click(nextBtn);
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('4P3');
  });

  it('Prev button does nothing at ply 0', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    const prevBtn = screen.getByLabelText('Previous move');
    fireEvent.click(prevBtn);
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('rnbqkbnr/pppppppp');
  });

  it('End button lands on final FEN', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    const endBtn = screen.getByLabelText('Go to end');
    fireEvent.click(endBtn);
    const board = screen.getByTestId('chessboard');
    const pos = board.getAttribute('data-position') ?? '';
    expect(pos.split(' ').slice(0, 4).join(' ')).toBe(FINAL_FEN.split(' ').slice(0, 4).join(' '));
  });

  it('Start button returns to ply 0', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    fireEvent.click(screen.getByLabelText('Go to end'));
    fireEvent.click(screen.getByLabelText('Go to start'));
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('rnbqkbnr/pppppppp');
  });

  it('ArrowRight key advances ply', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('4P3');
  });

  it('ArrowLeft key retreats ply', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('4P3');
  });

  it('ArrowUp key goes to start', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('rnbqkbnr/pppppppp');
  });

  it('ArrowDown key goes to end', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const board = screen.getByTestId('chessboard');
    const pos = board.getAttribute('data-position') ?? '';
    expect(pos.split(' ').slice(0, 4).join(' ')).toBe(FINAL_FEN.split(' ').slice(0, 4).join(' '));
  });

  it('Copy PGN calls navigator.clipboard.writeText with correct string', async () => {
    render(<ReviewClient game={MOCK_GAME} />);
    const copyBtn = screen.getByText('Copy PGN');
    await act(async () => { fireEvent.click(copyBtn); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_GAME.pgn);
  });

  it('Download PGN creates a Blob with type text/plain', () => {
    const { getByText } = render(<ReviewClient game={MOCK_GAME} />);

    const blobs: Blob[] = [];
    const origBlob = global.Blob;
    global.Blob = class extends origBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobs.push(this);
      }
    } as typeof Blob;

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.revokeObjectURL = vi.fn();

    const fakeAnchor = { href: '', download: '', click: vi.fn() };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return fakeAnchor as unknown as HTMLElement;
      return origCreate(tag);
    });

    fireEvent.click(getByText('Download PGN'));

    expect(blobs.length).toBeGreaterThan(0);
    expect(blobs[blobs.length - 1].type).toBe('text/plain');
    expect(fakeAnchor.click).toHaveBeenCalled();

    global.Blob = origBlob;
    vi.restoreAllMocks();
  });

  it('corrupt PGN shows error message instead of crashing', () => {
    render(<ReviewClient game={CORRUPT_GAME} />);
    expect(screen.getByText('Could not load this game')).toBeTruthy();
    expect(screen.queryByTestId('chessboard')).toBeNull();
  });

  it('clicking a move in the move list seeks to that ply', () => {
    render(<ReviewClient game={MOCK_GAME} />);
    const nf3Button = screen.getByText('Nf3');
    fireEvent.click(nf3Button);
    const board = screen.getByTestId('chessboard');
    const pos = board.getAttribute('data-position') ?? '';
    expect(pos).toContain('5N2');
  });
});
