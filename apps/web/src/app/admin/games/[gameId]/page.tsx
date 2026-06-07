'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { fetchGame } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';

export default function AdminGameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();

  const { data: game, isLoading } = useQuery({
    queryKey: ['admin-game', gameId],
    queryFn: () => fetchGame(gameId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!game) return <p className="text-sm text-destructive">Game not found</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-mono">{game.id}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{game.category}</Badge>
          <span>{game.timeControlSeconds}{game.incrementSeconds > 0 ? `+${game.incrementSeconds}` : ''}</span>
          {!game.isRated && <Badge variant="secondary">Unrated</Badge>}
          <Badge variant={game.status === 'completed' ? 'default' : 'secondary'}>{game.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border p-4">
          <p className="text-xs text-muted-foreground mb-1">White</p>
          <Link href={`/admin/users/${game.whitePlayer.id}`} className="font-medium hover:underline">
            {game.whitePlayer.username}
          </Link>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-xs text-muted-foreground mb-1">Black</p>
          <Link href={`/admin/users/${game.blackPlayer.id}`} className="font-medium hover:underline">
            {game.blackPlayer.username}
          </Link>
        </div>
      </div>

      {game.result && (
        <p className="text-sm">
          Result: <strong>{game.result}</strong>
          {game.resultReason && ` by ${game.resultReason}`}
          {game.endedAt && ` — ${formatRelativeTime(new Date(game.endedAt))}`}
        </p>
      )}

      {game.fairPlaySignals.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-destructive">Fair-Play Signals</h2>
          <div className="space-y-1">
            {game.fairPlaySignals.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <Badge variant="destructive">{s.signalType}</Badge>
                <span className="text-muted-foreground">score: {s.score.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium">Moves ({game.moves.length})</h2>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">SAN</th>
                <th className="px-3 py-2 text-left">UCI</th>
                <th className="px-3 py-2 text-left">Clock (ms)</th>
                <th className="px-3 py-2 text-left">Move time (ms)</th>
              </tr>
            </thead>
            <tbody>
              {game.moves.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-1 text-muted-foreground">{m.ply}</td>
                  <td className="px-3 py-1 font-semibold">{m.san}</td>
                  <td className="px-3 py-1 text-muted-foreground">{m.uci}</td>
                  <td className="px-3 py-1 text-muted-foreground">{m.clockAfterMoveMs}</td>
                  <td className="px-3 py-1 text-muted-foreground">{m.moveTimeMs}</td>
                </tr>
              ))}
              {game.moves.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    No moves recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
