'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { GameHistoryResponseDto } from '@purechess/shared';

type GameHistoryFilters = {
  username: string;
  category?: 'bullet' | 'blitz' | 'rapid';
  isRated?: boolean;
  isVsComputer?: boolean;
  pageSize?: number;
};

async function fetchGameHistory(
  username: string,
  filters: Omit<GameHistoryFilters, 'username'>,
  cursor?: string,
): Promise<GameHistoryResponseDto> {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.isRated !== undefined) params.set('isRated', String(filters.isRated));
  if (filters.isVsComputer !== undefined) params.set('isVsComputer', String(filters.isVsComputer));
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(filters.pageSize ?? 20));

  const res = await fetch(`/api/users/${username}/games?${params.toString()}`);
  if (!res.ok) {
    const err: { message?: string } = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to fetch game history');
  }
  return res.json() as Promise<GameHistoryResponseDto>;
}

export function useGameHistory({ username, category, isRated, isVsComputer, pageSize }: GameHistoryFilters) {
  return useInfiniteQuery({
    queryKey: ['gameHistory', username, category, isRated, isVsComputer, pageSize],
    queryFn: ({ pageParam }) =>
      fetchGameHistory(username, { category, isRated, isVsComputer, pageSize }, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(username),
  });
}
