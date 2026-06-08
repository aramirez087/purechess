'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchGames, type AdminGame } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

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

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn('px-4 py-2.5', className)}>{children}</td>;
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        {total} {total === 1 ? 'game' : 'games'}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2 font-mono tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
