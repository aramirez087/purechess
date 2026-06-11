'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { EmptyState } from '@/components/error-state';
import { GameHistoryFilters } from '@/components/games/game-history-filters';
import { GameHistoryList } from '@/components/games/game-history-list';
import { Button } from '@/components/ui/button';
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
      <div className="animate-rise-1">
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
      </div>

      {noGamesAtAll && !hasFilters && (
        <EmptyState
          className="animate-rise-2"
          headline="No games recorded."
          description="Your finished games will be archived here, ready for review."
          actions={
            <Button
              asChild
              variant="outline"
              className="border-brass/50 text-brass-text hover:border-brass/70 hover:bg-brass/10 hover:text-brass-text"
            >
              <Link href="/play">Play your first game</Link>
            </Button>
          }
        />
      )}

      {noGamesAtAll && hasFilters && (
        <EmptyState
          className="animate-rise-2"
          headline="Nothing matches this filter."
          description="Adjust the filters above, or clear them to see every game."
          actions={
            <Button variant="ghost" onClick={() => router.push('/games')}>
              Clear filters
            </Button>
          }
        />
      )}

      {allGames.length > 0 && (
        <div className="animate-rise-2">
          <GameHistoryList
            games={allGames}
            onLoadMore={fetchNextPage}
            hasMore={hasNextPage}
            isLoadingMore={isFetchingNextPage}
            total={data?.pages[0]?.total}
          />
        </div>
      )}
    </div>
  );
}
