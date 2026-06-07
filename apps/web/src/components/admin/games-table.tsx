'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchGames, type AdminGame } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';

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
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">ID</th>
                <th className="px-4 py-2 text-left font-medium">White</th>
                <th className="px-4 py-2 text-left font-medium">Black</th>
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Result</th>
                <th className="px-4 py-2 text-left font-medium">Ended</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/admin/games/${game.id}`} className="hover:underline text-primary">
                      {game.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-4 py-2">{game.whitePlayer.username}</td>
                  <td className="px-4 py-2">{game.blackPlayer.username}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">{game.category}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {game.timeControlSeconds}
                    {game.incrementSeconds > 0 ? `+${game.incrementSeconds}` : ''}
                    {game.isRated ? '' : ' (unrated)'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {game.result ?? game.status}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {game.endedAt ? formatRelativeTime(new Date(game.endedAt)) : '—'}
                  </td>
                </tr>
              ))}
              {games.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No games found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="px-2 py-1">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
