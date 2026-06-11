'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetInvite, useAcceptInvite } from '@/hooks/use-invite';
import { Clock, Swords, User } from 'lucide-react';

function formatTimeControl(seconds: number, increment: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const base = secs > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins}`;
  return increment > 0 ? `${base}+${increment}` : base;
}

interface InviteJoinProps {
  token: string;
}

export function InviteJoin({ token }: InviteJoinProps) {
  const router = useRouter();
  const { data: invite, isLoading, error } = useGetInvite(token);
  const accept = useAcceptInvite();

  async function handleAccept() {
    const result = await accept.mutateAsync(token);
    router.push(`/play/${result.gameId}`);
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-lg border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
        <CardHeader className="border-b border-border/60">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const status = (error as { status?: number }).status;
    const message =
      status === 410
        ? 'This invite has expired or been cancelled.'
        : 'Invite not found.';
    return (
      <Card className="w-full max-w-lg border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brass/10 ring-1 ring-inset ring-brass/30 text-brass">
              <Swords className="h-4 w-4" />
            </span>
            <CardTitle className="text-lg tracking-tight">Invite unavailable</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button
            asChild
            className="h-12 w-full bg-foreground text-background hover:bg-foreground/90 shadow-elevated text-[15px] font-medium"
          >
            <Link href="/play">Start your own game</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!invite) return null;

  // 'random' invites park the creator in the white slot until accept-time
  // randomization — don't promise the acceptor a concrete color.
  const isRandomColor = invite.colorChoice === 'random';
  const yourColor = isRandomColor
    ? 'Random'
    : invite.creatorColor === 'white'
      ? 'Black'
      : 'White';
  const timeLabel = formatTimeControl(invite.timeControlSeconds, invite.incrementSeconds);

  return (
    <Card className="w-full max-w-lg border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brass/10 ring-1 ring-inset ring-brass/30 text-brass">
            <Swords className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-lg tracking-tight">
              {invite.creator?.username ?? 'Someone'} challenges you
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
              {invite.category} · {timeLabel} · {invite.rated ? 'Rated' : 'Casual'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <dl className="grid grid-cols-3 gap-2">
          <Detail
            icon={User}
            label="You play"
            value={yourColor}
            hint={isRandomColor ? 'Decided when you join' : undefined}
          />
          <Detail icon={Clock} label="Time" value={timeLabel} mono />
          <Detail
            icon={Swords}
            label="Category"
            value={invite.category.charAt(0).toUpperCase() + invite.category.slice(1)}
          />
        </dl>

        <Button
          onClick={handleAccept}
          disabled={accept.isPending || invite.status !== 'invite_pending'}
          className="h-12 w-full bg-foreground text-background hover:bg-foreground/90 shadow-elevated text-[15px] font-medium"
        >
          {accept.isPending ? 'Joining…' : 'Accept & Play'}
        </Button>

        {accept.isError && (
          <div className="animate-error-in rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <p className="text-destructive">Failed to join. The invite may have been cancelled.</p>
            <Link
              href="/play"
              className="mt-1 inline-block text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Back to play
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  hint,
  mono = false,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-raised/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p
        className={`mt-1.5 text-sm font-medium ${mono ? 'font-mono tabular-nums' : ''}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
