import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyzeClient } from '@/app/analyze/analyze-client';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/board', () => ({
  Chessboard: ({ position }: { position: string }) => (
    <div data-testid="chessboard" data-position={position} />
  ),
}));

// Keep jsdom away from the Stockfish Web Worker: searches never complete.
vi.mock('@/lib/engine/stockfish-client', () => ({
  analyze: vi.fn(() => new Promise(() => {})),
}));

const PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
const MATE_PGN = '1. f3 e5 2. g4 Qh4#';
const FEN = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';

function loadInput(text: string) {
  render(<AnalyzeClient />);
  fireEvent.change(screen.getByLabelText(/game record/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
}

describe('AnalyzeClient', () => {
  it('renders the input screen with a PGN/FEN textarea', () => {
    render(<AnalyzeClient />);
    expect(screen.getByLabelText(/game record/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.queryByTestId('chessboard')).toBeNull();
  });

  it('parses a pasted PGN into the review shell with its moves', () => {
    loadInput(PGN);
    // Review shell took over: board at the start position, score sheet filled.
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('rnbqkbnr/pppppppp');
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(screen.getByText('Bb5')).toBeInTheDocument();
  });

  it('shows an honest "Analysis." verdict for a PGN with no result', () => {
    loadInput(PGN);
    expect(screen.getByText('Analysis.')).toBeInTheDocument();
    // No bogus outcome anywhere: no score line, no fabricated termination.
    expect(screen.queryByText('½ – ½')).toBeNull();
    expect(screen.queryByText('Checkmate.')).toBeNull();
    expect(screen.queryByText('Resignation.')).toBeNull();
  });

  it('derives checkmate verdict and score from a decisive PGN', () => {
    loadInput(MATE_PGN);
    expect(screen.getByText('Checkmate.')).toBeInTheDocument();
    expect(screen.getByText('0 – 1')).toBeInTheDocument();
  });

  it('parses a pasted FEN into a board-only review', () => {
    loadInput(FEN);
    const board = screen.getByTestId('chessboard');
    expect(board.getAttribute('data-position')).toContain('r1bqkbnr/1ppp1ppp/p1n5/1B2p3');
    // No moves: the score sheet shows its empty state, verdict stays honest.
    expect(screen.getByText(/no moves yet/i)).toBeInTheDocument();
    expect(screen.getByText('Analysis.')).toBeInTheDocument();
  });

  it('rejects unparseable input with a branded error and stays on the form', () => {
    loadInput('definitely not chess');
    expect(screen.getByRole('alert')).toHaveTextContent(/paste a complete pgn game or a fen/i);
    expect(screen.queryByTestId('chessboard')).toBeNull();
    expect(screen.getByLabelText(/game record/i)).toBeInTheDocument();
  });

  it('"New analysis" returns to the input screen with the paste preserved', () => {
    loadInput(FEN);
    fireEvent.click(screen.getByRole('button', { name: /new analysis/i }));
    const textarea = screen.getByLabelText(/game record/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe(FEN);
    expect(screen.queryByTestId('chessboard')).toBeNull();
  });
});
