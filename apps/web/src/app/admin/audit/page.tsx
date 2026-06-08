'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAudit, type AuditLog } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeTime, cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ChevronLeft, ChevronRight, Search, ScrollText } from 'lucide-react';

export default function AdminAuditPage() {
  const [adminUserId, setAdminUserId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: '20' };
  if (adminUserId) params.adminUserId = adminUserId;
  if (action) params.action = action;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', params],
    queryFn: () => fetchAudit(params),
  });

  const logs = (data?.logs ?? []) as AuditLog[];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit log"
        description="Every administrative action, in order."
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Admin user ID…"
            value={adminUserId}
            onChange={(e) => {
              setAdminUserId(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <ScrollText className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Action (e.g. disable_user)…"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border/70 bg-surface/60 p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60 shadow-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-background/60">
              <tr>
                <Th>When</Th>
                <Th>Admin</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Target ID</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-raised/40 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                    {formatRelativeTime(new Date(log.createdAt))}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{log.admin.username}</td>
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px]">
                      {log.action}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{log.targetType}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {log.targetId.slice(0, 12)}…
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No audit entries
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} {total === 1 ? 'entry' : 'entries'}
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
