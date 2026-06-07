'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FairplaySignals, type FairPlaySignalRow } from '@/components/admin/fairplay-signals';
import { fetchAdminReport, updateReportStatus } from '@/lib/api/reports';
import { formatRelativeTime } from '@/lib/utils';

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'open') return 'default';
  if (status === 'reviewed') return 'secondary';
  return 'outline';
}

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery({
    queryKey: ['admin-report', id],
    queryFn: () => fetchAdminReport(id),
  });

  const reviewMutation = useMutation({
    mutationFn: (status: 'reviewed' | 'dismissed') => updateReportStatus(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-report', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success('Report updated');
    },
    onError: () => toast.error('Failed to update report'),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!report) return <p className="text-sm text-destructive">Report not found</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Report #{report.id.slice(-8)}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filed by{' '}
            <Link href={`/admin/users/${report.reporter.id}`} className="underline">
              {report.reporter.username}
            </Link>{' '}
            against{' '}
            <Link href={`/admin/users/${report.reported.id}`} className="underline">
              {report.reported.username}
            </Link>
          </p>
        </div>
        <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Reason</p>
          <p className="mt-1 font-medium">{report.reason}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Filed</p>
          <p className="mt-1 font-medium">{formatRelativeTime(new Date(report.createdAt))}</p>
        </div>
        {report.reviewedAt && (
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Reviewed</p>
            <p className="mt-1 font-medium">{formatRelativeTime(new Date(report.reviewedAt))}</p>
          </div>
        )}
        {report.reviewedBy && (
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Reviewed by</p>
            <p className="mt-1 font-medium">{report.reviewedBy.username}</p>
          </div>
        )}
      </div>

      {report.notes && (
        <div className="rounded-md border p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="whitespace-pre-wrap">{report.notes}</p>
        </div>
      )}

      {report.game && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Game</h2>
          <div className="rounded-md border p-3 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">
                {report.game.whitePlayer.username} vs {report.game.blackPlayer.username}
              </span>
              <span className="ml-2 text-muted-foreground">
                {report.game.category} · {report.game.result ?? report.game.status}
              </span>
            </div>
            <Link href={`/games/${report.game.id}`} className="underline text-xs">
              Review game
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">
          {report.reported.username}'s last {report.reportedUserRecentGames.length} games
        </h2>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium">Opponent</th>
                <th className="px-3 py-2 text-left font-medium">Result</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {report.reportedUserRecentGames.map((g) => {
                const opponent = g.whitePlayer ?? g.blackPlayer;
                return (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/users/${opponent?.id}`} className="underline">
                        {opponent?.username ?? '—'}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{g.result ?? g.status}</td>
                    <td className="px-3 py-2">{g.category}</td>
                    <td className="px-3 py-2">{formatRelativeTime(new Date(g.createdAt))}</td>
                  </tr>
                );
              })}
              {report.reportedUserRecentGames.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                    No games found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Fair-play signals</h2>
        <FairplaySignals signals={report.reportedUserSignals} />
      </section>

      {report.status === 'open' && (
        <div className="flex gap-2">
          <Button
            onClick={() => reviewMutation.mutate('reviewed')}
            disabled={reviewMutation.isPending}
          >
            Mark reviewed
          </Button>
          <Button
            variant="outline"
            onClick={() => reviewMutation.mutate('dismissed')}
            disabled={reviewMutation.isPending}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
