'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAudit, type AuditLog } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeTime } from '@/lib/utils';

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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Admin user ID…"
          value={adminUserId}
          onChange={(e) => { setAdminUserId(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Input
          placeholder="Action (e.g. disable_user)…"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">When</th>
                <th className="px-4 py-2 text-left font-medium">Admin</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Target</th>
                <th className="px-4 py-2 text-left font-medium">Target ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {formatRelativeTime(new Date(log.createdAt))}
                  </td>
                  <td className="px-4 py-2">{log.admin.username}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2 text-muted-foreground">{log.targetType}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {log.targetId.slice(0, 12)}…
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No audit entries
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
