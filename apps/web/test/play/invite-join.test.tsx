import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { InvitePreview } from '@/hooks/use-invite';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-invite', () => ({
  useGetInvite: vi.fn(),
  useAcceptInvite: vi.fn(),
}));

import { useGetInvite, useAcceptInvite } from '@/hooks/use-invite';
import { InviteJoin } from '@/components/play/invite-join';

const mockUseGetInvite = vi.mocked(useGetInvite);
const mockUseAcceptInvite = vi.mocked(useAcceptInvite);

function makePreview(overrides: Partial<InvitePreview> = {}): InvitePreview {
  return {
    gameId: 'game-001',
    timeControlSeconds: 300,
    incrementSeconds: 0,
    category: 'blitz',
    creator: { id: 'user-creator', username: 'alice', avatarUrl: null },
    creatorColor: 'white',
    status: 'invite_pending',
    ...overrides,
  };
}

function mockInvite(invite: InvitePreview) {
  mockUseGetInvite.mockReturnValue({
    data: invite,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useGetInvite>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAcceptInvite.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useAcceptInvite>);
});

describe('InviteJoin "You play" detail', () => {
  it('shows "Random" with a decided-on-join hint for random-color invites', () => {
    mockInvite(makePreview({ colorChoice: 'random' }));

    render(<InviteJoin token="tok" />);

    expect(screen.getByText('You play')).toBeInTheDocument();
    expect(screen.getByText('Random')).toBeInTheDocument();
    expect(screen.getByText('Decided when you join')).toBeInTheDocument();
    expect(screen.queryByText('Black')).not.toBeInTheDocument();
  });

  it('shows the real assigned color when the creator picked white', () => {
    mockInvite(makePreview({ colorChoice: 'white', creatorColor: 'white' }));

    render(<InviteJoin token="tok" />);

    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.queryByText('Decided when you join')).not.toBeInTheDocument();
  });

  it('shows the real assigned color when the creator picked black', () => {
    mockInvite(makePreview({ colorChoice: 'black', creatorColor: 'black' }));

    render(<InviteJoin token="tok" />);

    expect(screen.getByText('White')).toBeInTheDocument();
    expect(screen.queryByText('Decided when you join')).not.toBeInTheDocument();
  });

  it('legacy previews without colorChoice fall back to the concrete slot color', () => {
    mockInvite(makePreview()); // no colorChoice — pre-column API response

    render(<InviteJoin token="tok" />);

    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.queryByText('Random')).not.toBeInTheDocument();
  });
});
