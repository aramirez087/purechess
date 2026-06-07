'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetInvite, useAcceptInvite } from '@/hooks/use-invite';

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
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invite Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!invite) return null;

  const opponentColor = invite.creatorColor === 'white' ? 'Black' : 'White';
  const timeLabel = formatTimeControl(invite.timeControlSeconds, invite.incrementSeconds);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {invite.creator?.username ?? 'Someone'} challenges you!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Time control: </span>
            <span className="font-medium">{timeLabel}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Category: </span>
            <span className="font-medium capitalize">{invite.category}</span>
          </p>
          <p>
            <span className="text-muted-foreground">You play: </span>
            <span className="font-medium">{opponentColor}</span>
          </p>
        </div>

        <Button
          onClick={handleAccept}
          disabled={accept.isPending || invite.status !== 'invite_pending'}
          className="w-full"
        >
          {accept.isPending ? 'Joining…' : 'Accept & Play'}
        </Button>

        {accept.isError && (
          <p className="text-sm text-destructive">
            Failed to join. The invite may have been cancelled.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
