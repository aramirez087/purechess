'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchQueues, fetchActiveGames } from '@/lib/api/admin';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

export default function AdminQueuesPage() {
  const { data: queues } = useQuery({
    queryKey: ['admin-queues'],
    queryFn: fetchQueues,
    refetchInterval: 5000,
  });

  const { data: activeGames } = useQuery({
    queryKey: ['admin-active-games'],
    queryFn: fetchActiveGames,
    refetchInterval: 5000,
  });

  const buckets = queues?.buckets ?? {};
  const bucketEntries = Object.entries(buckets) as [string, { count: number; oldestWaitMs: number }][];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Queues</h1>

      <div>
        <h2 className="mb-3 text-sm font-medium">Matchmaking Queues</h2>
        {bucketEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active queues</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {bucketEntries.map(([bucket, stats]) => (
              <div key={bucket} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground font-mono">{bucket}</p>
                <p className="mt-1 text-2xl font-bold">{stats.count}</p>
                <p className="text-xs text-muted-foreground">
                  Oldest: {stats.oldestWaitMs > 0 ? `${Math.round(stats.oldestWaitMs / 1000)}s` : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium">
          Active Games{' '}
          {activeGames && <Badge variant="secondary">{activeGames.count}</Badge>}
        </h2>
        {activeGames?.sample && activeGames.sample.length > 0 ? (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">White</th>
                  <th className="px-4 py-2 text-left font-medium">Black</th>
                  <th className="px-4 py-2 text-left font-medium">Category</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {activeGames.sample.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="px-4 py-2">{g.whitePlayer.username}</td>
                    <td className="px-4 py-2">{g.blackPlayer.username}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{g.category}</Badge></td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {g.endedAt ? formatRelativeTime(new Date(g.endedAt)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active games</p>
        )}
      </div>
    </div>
  );
}
