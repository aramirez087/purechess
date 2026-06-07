'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchAdminReports } from '@/lib/api/reports';
import { formatRelativeTime } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
];

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'open') return 'default';
  if (status === 'reviewed') return 'secondary';
  return 'outline';
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-48"
          placeholder="Reported user ID"
          value={reportedUserId}
          onChange={(e) => { setReportedUserId(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2 text-left font-medium">Reporter</th>
                  <th className="px-4 py-2 text-left font-medium">Reported</th>
                  <th className="px-4 py-2 text-left font-medium">Reason</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Count</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                  <th className="px-4 py-2 text-left font-medium">Reviewed by</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                    onClick={() => router.push(`/admin/reports/${r.id}`)}
                  >
                    <td className="px-4 py-2">{r.reporter.username}</td>
                    <td className="px-4 py-2">
                      <a
                        href={`/admin/users/${r.reported.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="underline"
                      >
                        {r.reported.username}
                      </a>
                    </td>
                    <td className="px-4 py-2">{r.reason}</td>
                    <td className="px-4 py-2">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2">{r.relatedCount}</td>
                    <td className="px-4 py-2">{formatRelativeTime(new Date(r.createdAt))}</td>
                    <td className="px-4 py-2">{r.reviewedBy?.username ?? '—'}</td>
                  </tr>
                ))}
                {data.reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No reports found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
