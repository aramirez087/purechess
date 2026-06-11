'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DisableAccountDialog } from '@/components/admin/disable-account-dialog';
import { FairplaySignals } from '@/components/admin/fairplay-signals';
import { GamesTable } from '@/components/admin/games-table';
import { fetchUser } from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => fetchUser(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user)
    return (
      <div className="rounded-lg border border-border/70 bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
        User not found
      </div>
    );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.username}
        description={user.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user.isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brass/30 bg-brass/10 px-2.5 py-1 text-[11px] font-medium text-brass">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </span>
            )}
            {user.isDisabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                Disabled
              </span>
            )}
            {!user.isAdmin && (
              <DisableAccountDialog
                userId={user.id}
                username={user.username}
                isDisabled={user.isDisabled}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Joined"
          value={formatRelativeTime(new Date(user.createdAt))}
        />
        <Stat
          label="Last seen"
          value={
            user.lastLoginAt
              ? formatRelativeTime(new Date(user.lastLoginAt))
              : 'Never'
          }
        />
        <Stat label="Games (white)" value={String(user._count.gamesAsWhite)} />
        <Stat label="Games (black)" value={String(user._count.gamesAsBlack)} />
        <Stat label="Reports received" value={String(user._count.reportsReceived)} />
        {user.ratings.map((r) => (
          <Stat
            key={r.category}
            label={`${r.category} rating`}
            value={String(r.rating)}
          />
        ))}
      </div>

      {user.oauthAccounts.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Linked OAuth providers
          </h2>
          <div className="flex flex-wrap gap-2">
            {user.oauthAccounts.map((a) => (
              <Badge
                key={a.provider}
                variant="secondary"
                className="capitalize text-[11px]"
              >
                {a.provider}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {user.fairPlaySignals.length > 0 && (
        <section className="space-y-3">
          {user.fairPlaySignals.some((s) => s.score > 0.7) && (
            <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Suspicious signals detected
              </span>
              <Link
                href={`/admin/reports?reportedUserId=${user.id}`}
                className="text-xs font-medium underline underline-offset-2"
              >
                Review reports →
              </Link>
            </div>
          )}
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Fair-play signals
          </h2>
          <FairplaySignals signals={user.fairPlaySignals} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recent games
        </h2>
        <GamesTable userId={user.id} />
      </section>
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
