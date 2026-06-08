'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useCreateInvite, useCancelInvite, useInviteSocket } from '@/hooks/use-invite';
import type { InviteColor, TimeControlCategory } from '@/hooks/use-invite';
import { Check, Copy, Link2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIME_CONTROLS: { label: string; sub: string; seconds: number; increment: number; category: TimeControlCategory }[] = [
  { label: '1+0', sub: 'Bullet', seconds: 60, increment: 0, category: 'bullet' },
  { label: '2+1', sub: 'Bullet', seconds: 120, increment: 1, category: 'bullet' },
  { label: '3+0', sub: 'Blitz', seconds: 180, increment: 0, category: 'blitz' },
  { label: '5+0', sub: 'Blitz', seconds: 300, increment: 0, category: 'blitz' },
  { label: '5+3', sub: 'Blitz', seconds: 300, increment: 3, category: 'blitz' },
  { label: '10+0', sub: 'Rapid', seconds: 600, increment: 0, category: 'rapid' },
  { label: '15+10', sub: 'Rapid', seconds: 900, increment: 10, category: 'rapid' },
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
      <Card className="border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-md bg-brass/10 ring-1 ring-inset ring-brass/30 text-brass">
              <span className="absolute inset-0 rounded-md animate-brass-pulse" aria-hidden />
              <Link2 className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-lg tracking-tight">Waiting for opponent…</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Share the link — the game starts the moment they accept.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-md border border-border/70 bg-raised/50 p-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Invite link
            </p>
            <code className="block break-all font-mono text-xs leading-relaxed">
              {inviteResult.inviteUrl}
            </code>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleCopy}
              className="h-11 flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy link
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="h-11 flex-1 text-muted-foreground hover:text-foreground"
            >
              Cancel invite
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-lg tracking-tight">Play a Friend</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick a time control, send the link.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-7 pt-6">
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Time control
          </Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {TIME_CONTROLS.map((tc, i) => (
              <button
                key={tc.label}
                type="button"
                onClick={() => setSelectedTimeControl(i)}
                aria-pressed={selectedTimeControl === i}
                className={cn(
                  'h-12 rounded-md text-sm font-medium transition-all',
                  'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedTimeControl === i
                    ? 'border-brass/60 bg-brass/10 text-foreground shadow-inner-hairline'
                    : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                <span className="block font-mono tabular-nums">{tc.label}</span>
                <span className="block text-[10px] uppercase tracking-wider opacity-70">
                  {tc.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Play as
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                aria-pressed={selectedColor === c.value}
                className={cn(
                  'h-10 rounded-md text-sm font-medium transition-all',
                  'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedColor === c.value
                    ? 'border-brass/60 bg-brass/10 text-foreground shadow-inner-hairline'
                    : 'border-border/70 bg-raised/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button
            onClick={handleCreate}
            disabled={createInvite.isPending}
            className="h-11 flex-1 bg-foreground text-background hover:bg-foreground/90 shadow-elevated"
          >
            {createInvite.isPending ? 'Creating…' : 'Create invite link'}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="h-11 flex-1 text-muted-foreground hover:text-foreground"
          >
            Back
          </Button>
        </div>

        {createInvite.isError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Failed to create invite. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
