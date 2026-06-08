'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FairplaySignals, type FairPlaySignalRow } from '@/components/admin/fairplay-signals';
import { fetchAdminReport, updateReportStatus } from '@/lib/api/reports';
import { formatRelativeTime, cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Check, X } from 'lucide-react';

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'open') return 'default';
  if (status === 'reviewed') return 'secondary';
  return 'outline';
}

function statusClasses(status: string): string {
  if (status === 'open')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (status === 'reviewed')
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return 'border-border/70 bg-raised text-muted-foreground';
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

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!report)
    return <p className="text-sm text-destructive">Report not found</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <AdminPageHeader
        title={`Report #${report.id.slice(-8)}`}
        description={
          <>
            Filed by{' '}
            <Link
              href={`/admin/users/${report.reporter.id}`}
              className="text-foreground hover:underline"
            >
              {report.reporter.username}
            </Link>{' '}
            against{' '}
            <Link
              href={`/admin/users/${report.reported.id}`}
              className="text-foreground hover:underline"
            >
              {report.reported.username}
            </Link>
          </>
        }
        actions={
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize',
              statusClasses(report.status),
            )}
          >
            {report.status}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Reason" value={report.reason} />
        <Stat
          label="Filed"
          value={formatRelativeTime(new Date(report.createdAt))}
        />
        {report.reviewedAt && (
          <Stat
            label="Reviewed"
            value={formatRelativeTime(new Date(report.reviewedAt))}
          />
        )}
        {report.reviewedBy && (
          <Stat label="Reviewed by" value={report.reviewedBy.username} />
        )}
      </div>

      {report.notes && (
        <section className="rounded-lg border border-border/70 bg-surface/60 p-4 shadow-elevated">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.notes}</p>
        </section>
      )}

      {report.game && (
        <section className="rounded-lg border border-border/70 bg-surface/60 p-4 shadow-elevated">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Game
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">
                {report.game.whitePlayer.username} vs{' '}
                {report.game.blackPlayer.username}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {report.game.category} · {report.game.result ?? report.game.status}
              </span>
            </div>
            <Link
              href={`/games/${report.game.id}`}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Review game →
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {report.reported.username}&apos;s last {report.reportedUserRecentGames.length} games
        </h2>
        <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-background/60">
              <tr>
                <Th>Opponent</Th>
                <Th>Result</Th>
                <Th>Category</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {report.reportedUserRecentGames.map((g) => {
                const opponent = g.whitePlayer ?? g.blackPlayer;
                return (
                  <tr key={g.id} className="hover:bg-raised/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/users/${opponent?.id}`}
                        className="font-medium hover:underline"
                      >
                        {opponent?.username ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.result ?? g.status}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {g.category}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {formatRelativeTime(new Date(g.createdAt))}
                    </td>
                  </tr>
                );
              })}
              {report.reportedUserRecentGames.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No games found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Fair-play signals
        </h2>
        <FairplaySignals signals={report.reportedUserSignals} />
      </section>

      {report.status === 'open' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-5">
          <Button
            onClick={() => reviewMutation.mutate('reviewed')}
            disabled={reviewMutation.isPending}
            className="bg-emerald-500/90 text-white hover:bg-emerald-500 shadow-elevated"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Mark reviewed
          </Button>
          <Button
            variant="outline"
            onClick={() => reviewMutation.mutate('dismissed')}
            disabled={reviewMutation.isPending}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-surface/60 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
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
