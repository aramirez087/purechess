'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchQueues, fetchActiveGames } from '@/lib/api/admin';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Activity, Clock } from 'lucide-react';

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
  const bucketEntries = Object.entries(buckets) as [
    string,
    { count: number; oldestWaitMs: number },
  ][];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Queues"
        description="Live matchmaking buckets and active games."
      />

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Matchmaking queues
        </h2>
        {bucketEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-surface/40 p-8 text-center text-sm text-muted-foreground">
            No active queues
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bucketEntries.map(([bucket, stats]) => (
              <div
                key={bucket}
                className="rounded-lg border border-border/70 bg-surface/60 p-4 shadow-elevated"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {bucket}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{stats.count}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Oldest:{' '}
                  {stats.oldestWaitMs > 0
                    ? `${Math.round(stats.oldestWaitMs / 1000)}s`
                    : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active games
          </h2>
          {activeGames && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5 text-[10px] font-medium text-brass">
              <Activity className="h-2.5 w-2.5" />
              {activeGames.count}
            </span>
          )}
        </div>
        {activeGames?.sample && activeGames.sample.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-background/60">
                <tr>
                  <Th>White</Th>
                  <Th>Black</Th>
                  <Th>Category</Th>
                  <Th>Started</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activeGames.sample.map((g) => (
                  <tr key={g.id} className="hover:bg-raised/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{g.whitePlayer.username}</td>
                    <td className="px-4 py-2.5 font-medium">{g.blackPlayer.username}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {g.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {g.endedAt ? formatRelativeTime(new Date(g.endedAt)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-surface/40 p-8 text-center text-sm text-muted-foreground">
            No active games
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
    >
      {children}
    </th>
  );
}
