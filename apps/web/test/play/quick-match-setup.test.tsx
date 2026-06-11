import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MATCHMAKING_TIME_CONTROLS } from '@purechess/shared';
import { QuickMatchSetup } from '@/components/play/quick-match-setup';
import { useMatchmaking, type MatchmakingState } from '@/hooks/use-matchmaking';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const join = vi.fn();
const cancel = vi.fn();
let state: MatchmakingState = { phase: 'idle' };

vi.mock('@/hooks/use-matchmaking', async () => {
  const actual = await vi.importActual('@/hooks/use-matchmaking');
  return {
    ...actual,
    useMatchmaking: vi.fn(() => ({ state, join, cancel })),
  };
});

describe('QuickMatchSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = { phase: 'idle' };
  });

  it('renders one pill per shared preset and joins with the selection', () => {
    render(<QuickMatchSetup />);

    for (const tc of MATCHMAKING_TIME_CONTROLS) {
      expect(screen.getByRole('button', { name: `${tc.sub} ${tc.label}` })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Rapid 10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /^Casual/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Find opponent' }));

    expect(join).toHaveBeenCalledWith({
      timeControlSeconds: 600,
      incrementSeconds: 0,
      category: 'rapid',
      rated: false,
    });
  });

  it('searching state shows the timer and a working cancel', () => {
    state = { phase: 'searching', elapsedSeconds: 75 };
    render(<QuickMatchSetup />);

    expect(screen.getByText('1:15')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel search' }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('matched state navigates to the live game', () => {
    state = { phase: 'matched', gameId: 'game-42' };
    render(<QuickMatchSetup />);

    expect(push).toHaveBeenCalledWith('/play/game-42');
  });

  it('a 401 error offers a sign-in link', () => {
    state = { phase: 'error', message: 'Unauthorized', unauthenticated: true };
    render(<QuickMatchSetup />);

    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link.getAttribute('href')).toBe('/login?return=%2Fplay');
  });
});
