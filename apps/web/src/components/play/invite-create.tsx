'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCreateInvite, useCancelInvite, useInviteSocket } from '@/hooks/use-invite';
import type { InviteColor, TimeControlCategory } from '@/hooks/use-invite';

const TIME_CONTROLS: { label: string; seconds: number; increment: number; category: TimeControlCategory }[] = [
  { label: 'Bullet 1+0', seconds: 60, increment: 0, category: 'bullet' },
  { label: 'Bullet 2+1', seconds: 120, increment: 1, category: 'bullet' },
  { label: 'Blitz 3+0', seconds: 180, increment: 0, category: 'blitz' },
  { label: 'Blitz 5+0', seconds: 300, increment: 0, category: 'blitz' },
  { label: 'Blitz 5+3', seconds: 300, increment: 3, category: 'blitz' },
  { label: 'Rapid 10+0', seconds: 600, increment: 0, category: 'rapid' },
  { label: 'Rapid 15+10', seconds: 900, increment: 10, category: 'rapid' },
];

const COLORS: { label: string; value: InviteColor }[] = [
  { label: 'White', value: 'white' },
  { label: 'Black', value: 'black' },
  { label: 'Random', value: 'random' },
];

interface InviteCreateProps {
  onCancel: () => void;
}

export function InviteCreate({ onCancel }: InviteCreateProps) {
  const router = useRouter();
  const [selectedTimeControl, setSelectedTimeControl] = useState(3);
  const [selectedColor, setSelectedColor] = useState<InviteColor>('random');
  const [inviteResult, setInviteResult] = useState<{ gameId: string; inviteUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = useCreateInvite();
  const cancelInvite = useCancelInvite();

  useInviteSocket(inviteResult?.gameId ?? null, (gameId) => {
    router.push(`/play/${gameId}`);
  });

  async function handleCreate() {
    const tc = TIME_CONTROLS[selectedTimeControl];
    const result = await createInvite.mutateAsync({
      timeControlSeconds: tc.seconds,
      incrementSeconds: tc.increment,
      category: tc.category,
      color: selectedColor,
    });
    setInviteResult({ gameId: result.gameId, inviteUrl: result.inviteUrl });
  }

  async function handleCopy() {
    if (!inviteResult) return;
    await navigator.clipboard.writeText(inviteResult.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCancel() {
    if (inviteResult) {
      const token = inviteResult.inviteUrl.split('/invite/')[1];
      if (token) await cancelInvite.mutateAsync(token).catch(() => null);
    }
    onCancel();
  }

  if (inviteResult) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Waiting for opponent…</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this link with your friend:
          </p>
          <div className="flex gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">
              {inviteResult.inviteUrl}
            </code>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCopy} variant="outline" className="flex-1">
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button onClick={handleCancel} variant="ghost" className="flex-1">
              Cancel Invite
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Play a Friend</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Time Control</Label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_CONTROLS.map((tc, i) => (
              <Button
                key={tc.label}
                variant={selectedTimeControl === i ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeControl(i)}
              >
                {tc.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Play as</Label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <Button
                key={c.value}
                variant={selectedColor === c.value ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setSelectedColor(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleCreate}
            disabled={createInvite.isPending}
            className="flex-1"
          >
            {createInvite.isPending ? 'Creating…' : 'Create Invite Link'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Back
          </Button>
        </div>

        {createInvite.isError && (
          <p className="text-sm text-destructive">
            Failed to create invite. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
