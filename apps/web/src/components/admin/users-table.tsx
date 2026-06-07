'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchUsers, type AdminUser } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';

export function UsersTable() {
  const [q, setQ] = useState('');
  const [disabled, setDisabled] = useState<string>('');
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), pageSize: '20' };
  if (q) params.q = q;
  if (disabled) params.disabled = disabled;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => fetchUsers(params),
  });

  const users = (data?.users ?? []) as AdminUser[];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search username or email…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <select
          className="rounded-md border px-3 py-2 text-sm bg-background"
          value={disabled}
          onChange={(e) => { setDisabled(e.target.value); setPage(1); }}
        >
          <option value="">All users</option>
          <option value="false">Active</option>
          <option value="true">Disabled</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Username</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Joined</th>
                <th className="px-4 py-2 text-left font-medium">Last seen</th>
                <th className="px-4 py-2 text-left font-medium">Ratings</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-2">
                    <Link href={`/admin/users/${user.id}`} className="hover:underline font-medium">
                      {user.username}
                    </Link>
                    {user.isAdmin && <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatRelativeTime(new Date(user.createdAt))}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {user.lastLoginAt ? formatRelativeTime(new Date(user.lastLoginAt)) : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {user.ratings.map((r) => `${r.category}: ${r.rating}`).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {user.isDisabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No users found
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
