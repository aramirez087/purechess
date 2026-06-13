'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { fetchUsers, type AdminUser } from '@/lib/api/admin';
import { formatRelativeTime, cn } from '@/lib/utils';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';
import { Th, TableShell, TableLoadingState, TablePagination } from './data-table';

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search username or email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <div className="inline-flex rounded-md border border-border/70 bg-raised/50 p-0.5">
          {[
            { value: '', label: 'All' },
            { value: 'false', label: 'Active' },
            { value: 'true', label: 'Disabled' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setDisabled(opt.value);
                setPage(1);
              }}
              aria-pressed={disabled === opt.value}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                disabled === opt.value
                  ? 'bg-background text-foreground shadow-elevated'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <TableLoadingState />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-background/60">
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Joined</Th>
                <Th>Last seen</Th>
                <Th>Ratings</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-raised/40"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-medium hover:underline"
                      >
                        {user.username}
                      </Link>
                      {user.isAdmin && (
                        <Badge variant="outline" className="text-[10px] text-brass border-brass/30 bg-brass/5">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {formatRelativeTime(new Date(user.createdAt))}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {user.lastLoginAt
                      ? formatRelativeTime(new Date(user.lastLoginAt))
                      : 'Never'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {user.ratings.length > 0
                      ? user.ratings
                          .map((r) => `${r.category}: ${r.rating}`)
                          .join(' · ')
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {user.isDisabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        <ShieldOff className="h-3 w-3" />
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        singularLabel="user"
        onPageChange={setPage}
      />
    </div>
  );
}
