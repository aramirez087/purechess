'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { GameHistoryFilters } from '@/components/games/game-history-filters';
import { GameHistoryList } from '@/components/games/game-history-list';
import { useGameHistory } from '@/hooks/use-game-history';

type Category = 'bullet' | 'blitz' | 'rapid';

type GamesClientProps = {
  username: string;
  initialCategory?: Category;
  initialIsRated?: boolean;
  initialIsVsComputer?: boolean;
};

export function GamesClient({ username, initialCategory, initialIsRated, initialIsVsComputer }: GamesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = (searchParams.get('category') as Category | null) ?? initialCategory;
  const isRatedParam = searchParams.get('isRated');
  const isRated =
    isRatedParam === 'true' ? true : isRatedParam === 'false' ? false : initialIsRated;
  const vsComputerParam = searchParams.get('vsComputer');
  const isVsComputer =
    vsComputerParam === 'true' ? true : vsComputerParam === 'false' ? false : initialIsVsComputer;

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      router.push(`/games?${params.toString()}`);
    },
    [router, searchParams],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useGameHistory({
    username,
    category,
    isRated,
    isVsComputer,
    pageSize: 20,
  });

  const allGames = data?.pages.flatMap((p) => p.games) ?? [];
  const noGamesAtAll = !data || (data.pages.length === 1 && data.pages[0].games.length === 0);
  const hasFilters = category !== undefined || isRated !== undefined || isVsComputer !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <GameHistoryFilters
        category={category}
        isRated={isRated}
        isVsComputer={isVsComputer}
        onCategoryChange={(v) => updateParams({ category: v })}
        onRatedChange={(v) =>
          updateParams({ isRated: v === undefined ? undefined : String(v) })
        }
        onVsComputerChange={(v) =>
          updateParams({ vsComputer: v === undefined ? undefined : String(v) })
        }
      />

      {noGamesAtAll && !hasFilters && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          You haven&apos;t played any games yet.{' '}
          <a href="/play" className="underline underline-offset-2 hover:text-foreground">
            Start with /play
          </a>
          .
        </p>
      )}

      {noGamesAtAll && hasFilters && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No games match these filters.{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => router.push('/games')}
          >
            Try clearing them
          </button>
          .
        </p>
      )}

      {allGames.length > 0 && (
        <GameHistoryList
          games={allGames}
          onLoadMore={fetchNextPage}
          hasMore={hasNextPage}
          isLoadingMore={isFetchingNextPage}
        />
      )}
    </div>
  );
}
