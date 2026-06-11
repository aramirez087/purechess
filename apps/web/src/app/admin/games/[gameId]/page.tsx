'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { fetchGame } from '@/lib/api/admin';
import { formatRelativeTime, cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export default function AdminGameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();

  const { data: game, isLoading } = useQuery({
    queryKey: ['admin-game', gameId],
    queryFn: () => fetchGame(gameId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!game)
    return (
      <div className="rounded-lg border border-border/70 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
        Game not found
      </div>
    );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={game.id}
        description={
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="capitalize text-[10px]">
              {game.category}
            </Badge>
            <span className="font-mono tabular-nums">
              {game.timeControlSeconds}
              {game.incrementSeconds > 0 ? `+${game.incrementSeconds}` : ''}
            </span>
            {!game.isRated && (
              <Badge variant="secondary" className="text-[10px]">
                Unrated
              </Badge>
            )}
            <Badge
              variant={game.status === 'completed' ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {game.status}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-surface/60 p-4 shadow-elevated">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            White
          </p>
          <Link
            href={`/admin/users/${game.whitePlayer.id}`}
            className="mt-1 inline-block font-medium hover:underline"
          >
            {game.whitePlayer.username}
          </Link>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface/60 p-4 shadow-elevated">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Black
          </p>
          <Link
            href={`/admin/users/${game.blackPlayer.id}`}
            className="mt-1 inline-block font-medium hover:underline"
          >
            {game.blackPlayer.username}
          </Link>
        </div>
      </div>

      {game.result && (
        <p className="text-sm">
          <span className="text-muted-foreground">Result: </span>
          <strong
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              game.result === 'white_wins' &&
                'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              game.result === 'black_wins' &&
                'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
              game.result === 'draw' &&
                'border-border/70 bg-raised text-muted-foreground',
            )}
          >
            {game.result.replace('_', ' ')}
          </strong>
          {game.resultReason && (
            <span className="ml-2 text-muted-foreground">by {game.resultReason}</span>
          )}
          {game.endedAt && (
            <span className="ml-2 text-muted-foreground">
              — {formatRelativeTime(new Date(game.endedAt))}
            </span>
          )}
        </p>
      )}

      {game.fairPlaySignals.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
            Fair-play signals
          </h2>
          <div className="space-y-1.5">
            {game.fairPlaySignals.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-2.5 text-sm"
              >
                <Badge variant="destructive" className="text-[10px]">
                  {s.signalType}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  score: {s.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Moves ({game.moves.length})
        </h2>
        <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
          <table className="w-full text-sm font-mono">
            <thead className="border-b border-border/60 bg-background/60">
              <tr>
                <Th className="w-12">#</Th>
                <Th>SAN</Th>
                <Th>UCI</Th>
                <Th>Clock (ms)</Th>
                <Th>Move time (ms)</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {game.moves.map((m) => (
                <tr key={m.id} className="hover:bg-raised/40 transition-colors">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{m.ply}</td>
                  <td className="px-4 py-2 font-semibold">{m.san}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{m.uci}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {m.clockAfterMoveMs}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {m.moveTimeMs}
                  </td>
                </tr>
              ))}
              {game.moves.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No moves recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
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
