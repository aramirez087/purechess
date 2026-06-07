import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { EditProfileDialog } from '@/components/profile/edit-profile-dialog';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('EditProfileDialog', () => {
  it('does not render form when closed', () => {
    render(
      <EditProfileDialog
        open={false}
        onOpenChange={vi.fn()}
        currentUsername="alice"
        currentAvatarUrl={null}
      />,
    );
    expect(screen.queryByLabelText(/username/i)).toBeNull();
  });

  it('renders form inputs when open', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={vi.fn()}
        currentUsername="alice"
        currentAvatarUrl={null}
      />,
    );
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/avatar url/i)).toBeTruthy();
  });

  it('calls PATCH /api/users/me on save', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: '1', username: 'alice', avatarUrl: null, isAdmin: false, createdAt: new Date() } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <EditProfileDialog
        open={true}
        onOpenChange={vi.fn()}
        currentUsername="alice"
        currentAvatarUrl={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/me',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('shows error message on failed save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Username already taken' }),
    }));

    render(
      <EditProfileDialog
        open={true}
        onOpenChange={vi.fn()}
        currentUsername="alice"
        currentAvatarUrl={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText('Username already taken')).toBeTruthy();
    });
  });
});
