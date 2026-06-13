import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { pushMock, toastError } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

import { PracticeFromFenDialog } from '@/components/play/practice-from-fen-dialog';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => body });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_API_URL;
  vi.stubGlobal('fetch', vi.fn());
});

describe('PracticeFromFenDialog', () => {
  it('renders the first two FEN fields in the subtitle', () => {
    render(<PracticeFromFenDialog fen={FEN} open onClose={vi.fn()} />);
    expect(
      screen.getByText('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w'),
    ).toBeTruthy();
  });

  it('POSTs to /computer-games/from-fen with the fen and settings', async () => {
    const mockFetch = okFetch({ gameId: 'g1' });
    vi.stubGlobal('fetch', mockFetch);

    render(<PracticeFromFenDialog fen={FEN} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/computer-games/from-fen');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.fen).toBe(FEN);
    expect(body.color).toBe('random');
    expect(body.timeControlSeconds).toBe(300);
    expect(body.incrementSeconds).toBe(3);
    expect(body.level).toBe(4);
  });

  it('navigates to /computer-game/[gameId] on success', async () => {
    vi.stubGlobal('fetch', okFetch({ gameId: 'g1' }));

    render(<PracticeFromFenDialog fen={FEN} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/computer-game/g1'));
  });

  it('shows an error toast on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'Boom' }) }),
    );

    render(<PracticeFromFenDialog fen={FEN} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toContain('Boom');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('Cancel calls onClose without an API call', () => {
    const onClose = vi.fn();
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(<PracticeFromFenDialog fen={FEN} open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
