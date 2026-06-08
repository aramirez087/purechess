'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { fetchAdminReports } from '@/lib/api/reports';
import { formatRelativeTime, cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ChevronRight as ArrowRight, Filter } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
];

function statusClasses(status: string): string {
  if (status === 'open')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (status === 'reviewed')
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return 'border-border/70 bg-raised text-muted-foreground';
}

export function ReportsTable() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [reportedUserId, setReportedUserId] = useState('');
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: '20' };
  if (status) params.status = status;
  if (reportedUserId.trim()) params.reportedUserId = reportedUserId.trim();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', params],
    queryFn: () => fetchAdminReports(params),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-raised/50 p-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
              aria-pressed={status === opt.value}
              className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                status === opt.value
                  ? 'bg-background text-foreground shadow-elevated'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          className="rounded-md border border-border/70 bg-raised/50 px-3 py-1.5 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48"
          placeholder="Reported user ID"
          value={reportedUserId}
          onChange={(e) => {
            setReportedUserId(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading && (
        <div className="rounded-lg border border-border/70 bg-surface/60 p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {data && (
        <>
          <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-background/60">
                <tr>
                  <Th>Reporter</Th>
                  <Th>Reported</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Count</Th>
                  <Th>Created</Th>
                  <Th>Reviewed by</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.reports.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer transition-colors hover:bg-raised/40"
                    onClick={() => router.push(`/admin/reports/${r.id}`)}
                  >
                    <Td>{r.reporter.username}</Td>
                    <Td>
                      <a
                        href={`/admin/users/${r.reported.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:underline"
                      >
                        {r.reported.username}
                      </a>
                    </Td>
                    <Td className="text-muted-foreground">{r.reason}</Td>
                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
                          statusClasses(r.status),
                        )}
                      >
                        {r.status}
                      </span>
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      {r.relatedCount}
                    </Td>
                    <Td className="text-muted-foreground text-xs">
                      {formatRelativeTime(new Date(r.createdAt))}
                    </Td>
                    <Td className="text-muted-foreground text-xs">
                      {r.reviewedBy?.username ?? '—'}
                    </Td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      <ArrowRight className="inline h-3.5 w-3.5" />
                    </td>
                  </tr>
                ))}
                {data.reports.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No reports found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {data.total} {data.total === 1 ? 'report' : 'reports'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
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
