'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { fetchGames, type AdminGame } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { Th, Td, TablePagination } from './data-table';

interface GamesTableProps {
  userId?: string;
}

export function GamesTable({ userId }: GamesTableProps) {
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: '20' };
  if (userId) params.userId = userId;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-games', params],
    queryFn: () => fetchGames(params),
  });

  const games = (data?.games ?? []) as AdminGame[];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="rounded-lg border border-border/70 bg-surface/60 p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-background/60">
              <tr>
                <Th>ID</Th>
                <Th>White</Th>
                <Th>Black</Th>
                <Th>Category</Th>
                <Th>Time</Th>
                <Th>Result</Th>
                <Th>Ended</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {games.map((game) => (
                <tr
                  key={game.id}
                  className="transition-colors hover:bg-raised/40"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link
                      href={`/admin/games/${game.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {game.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <Td>
                    <Link
                      href={`/admin/users/${game.whitePlayer.id}`}
                      className="font-medium hover:underline"
                    >
                      {game.whitePlayer.username}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/users/${game.blackPlayer.id}`}
                      className="font-medium hover:underline"
                    >
                      {game.blackPlayer.username}
                    </Link>
                  </Td>
                  <Td>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {game.category}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground font-mono text-xs">
                    {game.timeControlSeconds}
                    {game.incrementSeconds > 0 ? `+${game.incrementSeconds}` : ''}
                    {!game.isRated && (
                      <span className="ml-1 text-[10px] text-muted-foreground/70">
                        (unrated)
                      </span>
                    )}
                  </Td>
                  <Td>
                    {game.result ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          game.result === 'white_wins' &&
                            'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                          game.result === 'black_wins' &&
                            'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
                          game.result === 'draw' &&
                            'border-border/70 bg-raised text-muted-foreground',
                        )}
                      >
                        {game.result.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{game.status}</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    {game.endedAt ? formatRelativeTime(new Date(game.endedAt)) : '—'}
                  </Td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/games/${game.id}`}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label="View game"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {games.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No games found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        singularLabel="game"
        onPageChange={setPage}
      />
    </div>
  );
}

