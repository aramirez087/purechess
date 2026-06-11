import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api/computer-games', () => ({
  createComputerGame: vi.fn(),
}));

import { createComputerGame } from '@/lib/api/computer-games';
import { ComputerGameSetup } from '@/components/play/computer-game-setup';

const mockCreate = vi.mocked(createComputerGame);

beforeEach(() => {
  mockCreate.mockResolvedValue({
    gameId: 'test-game-id',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    status: 'active',
    computerColor: 'black',
    computerLevel: 4,
    lastComputerMove: null,
    result: null,
    resultReason: null,
  });
  vi.clearAllMocks();
});

describe('ComputerGameSetup', () => {
  it('level aria-pressed reflects selected level and label updates', () => {
    render(<ComputerGameSetup onCancel={vi.fn()} onGameCreated={vi.fn()} />);

    const btn6 = screen.getByRole('button', { name: /level 6 advanced/i });
    fireEvent.click(btn6);

    expect(btn6).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /level 1 beginner$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Strength label in header shows the selected level name
    expect(screen.getAllByText(/level 6/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/advanced/i).length).toBeGreaterThan(0);
  });

  it('default payload is backward-compatible (level=4, untimed, no optional fields)', async () => {
    render(<ComputerGameSetup onCancel={vi.fn()} onGameCreated={vi.fn()} />);

    mockCreate.mockResolvedValueOnce({
      gameId: 'test-game-id',
      fen: '',
      pgn: '',
      status: 'active',
      computerColor: 'black',
      computerLevel: 4,
      lastComputerMove: null,
      result: null,
      resultReason: null,
    });

    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        level: 4,
        color: 'random',
        timeControlSeconds: 0,
        incrementSeconds: 0,
      }),
    );
  });

  it('selecting level 6 sends level:6 in payload', async () => {
    render(<ComputerGameSetup onCancel={vi.fn()} onGameCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /level 6 advanced/i }));
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        level: 6,
        color: 'random',
        timeControlSeconds: 0,
        incrementSeconds: 0,
      }),
    );
  });

  it('choosing blitz 3+2 sets timeControlSeconds:180 incrementSeconds:2', async () => {
    render(<ComputerGameSetup onCancel={vi.fn()} onGameCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /blitz 3\+2/i }));
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          timeControlSeconds: 180,
          incrementSeconds: 2,
        }),
      ),
    );
  });

  it('ELO mode hides level grid and sends eloTarget in payload', async () => {
    render(<ComputerGameSetup onCancel={vi.fn()} onGameCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /elo target/i }));

    // Level grid should be gone
    expect(screen.queryByRole('button', { name: /level 1 beginner/i })).toBeNull();

    // Change ELO value
    const eloInput = screen.getByRole('spinbutton', { name: /elo target value/i });
    fireEvent.change(eloInput, { target: { value: '1200' } });

    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eloTarget: 1200,
        }),
      ),
    );
  });

  it('human-like toggle sends styleBlunderCp:50 in payload', async () => {
    render(<ComputerGameSetup onCancel={vi.fn()} onGameCreated={vi.fn()} />);

    const humanSwitch = screen.getByRole('switch', { name: /human-like play/i });
    fireEvent.click(humanSwitch);

    fireEvent.click(screen.getByRole('button', { name: /start game/i }));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          styleBlunderCp: 50,
        }),
      ),
    );
  });
});
