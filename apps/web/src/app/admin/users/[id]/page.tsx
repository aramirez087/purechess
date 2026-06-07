'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DisableAccountDialog } from '@/components/admin/disable-account-dialog';
import { FairplaySignals, type FairPlaySignalRow } from '@/components/admin/fairplay-signals';
import { GamesTable } from '@/components/admin/games-table';
import { fetchUser } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => fetchUser(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <p className="text-sm text-destructive">User not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {user.username}
            {user.isAdmin && <Badge variant="outline">Admin</Badge>}
            {user.isDisabled && <Badge variant="destructive">Disabled</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        {!user.isAdmin && (
          <DisableAccountDialog
            userId={user.id}
            username={user.username}
            isDisabled={user.isDisabled}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Joined" value={formatRelativeTime(new Date(user.createdAt))} />
        <Stat label="Last seen" value={user.lastLoginAt ? formatRelativeTime(new Date(user.lastLoginAt)) : 'Never'} />
        <Stat label="Games (white)" value={String(user._count.gamesAsWhite)} />
        <Stat label="Games (black)" value={String(user._count.gamesAsBlack)} />
        <Stat label="Reports received" value={String(user._count.reportsReceived)} />
        {user.ratings.map((r) => (
          <Stat key={r.category} label={r.category} value={String(r.rating)} />
        ))}
      </div>

      {user.oauthAccounts.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium">OAuth Accounts</h2>
          <div className="flex gap-2">
            {user.oauthAccounts.map((a) => (
              <Badge key={a.provider} variant="secondary">{a.provider}</Badge>
            ))}
          </div>
        </div>
      )}

      {user.fairPlaySignals.length > 0 && (
        <div>
          {user.fairPlaySignals.some((s) => s.score > 0.7) && (
            <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800 flex items-center justify-between">
              <span>Suspicious signals detected</span>
              <Link
                href={`/admin/reports?reportedUserId=${user.id}`}
                className="underline font-medium"
              >
                Review reports
              </Link>
            </div>
          )}
          <h2 className="mb-2 text-sm font-medium">Fair-play signals</h2>
          <FairplaySignals signals={user.fairPlaySignals} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium">Recent Games</h2>
        <GamesTable userId={user.id} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
