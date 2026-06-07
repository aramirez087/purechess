'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProfileDto } from '@purchess/shared';

async function fetchProfile(username: string): Promise<ProfileDto> {
  const res = await fetch(`/api/users/${username}`);
  if (!res.ok) {
    const err: { message?: string } = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to fetch profile');
  }
  return res.json() as Promise<ProfileDto>;
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfile(username),
    staleTime: 60 * 1000,
    enabled: Boolean(username),
  });
}
