'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Zap } from 'lucide-react';
import { MATCHMAKING_TIME_CONTROLS } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PILL_ACTIVE, PILL_BASE, PILL_INACTIVE } from '@/components/play/pill-styles';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { cn } from '@/lib/utils';

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function QuickMatchSetup() {
  const router = useRouter();
  const [selectedTimeControl, setSelectedTimeControl] = useState(2);
  const [rated, setRated] = useState(true);
  const { state, join, cancel } = useMatchmaking();

  // Navigate as soon as the pairing lands (push or poll).
  useEffect(() => {
    if (state.phase === 'matched') {
      router.push(`/play/${state.gameId}`);
    }
  }, [state, router]);

  async function handleFind() {
    const tc = MATCHMAKING_TIME_CONTROLS[selectedTimeControl]!;
    await join({
      timeControlSeconds: tc.seconds,
      incrementSeconds: tc.increment,
      category: tc.category,
      rated,
    });
  }

  async function handleCancel() {
    await cancel();
  }

  if (state.phase === 'searching' || state.phase === 'matched') {
    const tc = MATCHMAKING_TIME_CONTROLS[selectedTimeControl]!;
    const matched = state.phase === 'matched';
    return (
      <Card className="border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-md bg-brass/10 ring-1 ring-inset ring-brass/30 text-brass">
              <span
                className="absolute inset-0 rounded-md animate-brass-pulse motion-reduce:animate-none"
                aria-hidden
              />
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-lg tracking-tight">
                {matched ? 'Opponent found' : 'Finding an opponent…'}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tc.sub} {tc.label} · {rated ? 'Rated' : 'Casual'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2
              className="h-5 w-5 animate-spin text-brass motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="font-mono text-2xl tabular-nums tracking-tight">
              {matched ? 'Joining…' : formatElapsed(state.elapsedSeconds)}
            </span>
          </div>
          <p aria-live="polite" className="sr-only">
            {matched ? 'Match found — joining the game' : 'Searching for an opponent'}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            The window widens the longer you wait. You&apos;ll be paired with the closest rating
            available.
          </p>
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={matched}
            className="h-11 w-full text-muted-foreground hover:text-foreground"
          >
            Cancel search
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-raised ring-1 ring-inset ring-border text-brass">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-lg tracking-tight">Quick Match</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick a time control — we pair you with the closest rating.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-7 pt-6">
        <div className="space-y-3">
          <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Time control
          </Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-7">
            {MATCHMAKING_TIME_CONTROLS.map((tc, i) => (
              <button
                key={tc.label}
                type="button"
                onClick={() => setSelectedTimeControl(i)}
                aria-pressed={selectedTimeControl === i}
                aria-label={tc.sub + ' ' + tc.label}
                className={cn(
                  PILL_BASE,
                  'flex h-auto flex-col items-center justify-center gap-0.5 py-2',
                  selectedTimeControl === i ? PILL_ACTIVE : PILL_INACTIVE,
                )}
              >
                <span className="font-mono text-[11px] leading-none tabular-nums">{tc.label}</span>
                <span className="text-[11px] leading-none">{tc.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Stakes
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Rated', value: true, sub: 'Counts toward your rating' },
              { label: 'Casual', value: false, sub: 'Just for the game' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setRated(opt.value)}
                aria-pressed={rated === opt.value}
                className={cn(
                  PILL_BASE,
                  'flex h-auto flex-col items-center justify-center gap-0.5 py-2',
                  rated === opt.value ? PILL_ACTIVE : PILL_INACTIVE,
                )}
              >
                <span className="text-sm leading-none">{opt.label}</span>
                <span className="text-[11px] leading-none">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleFind}
            className="h-11 w-full bg-foreground text-background hover:bg-foreground/90 shadow-elevated"
          >
            Find opponent
          </Button>
        </div>

        {state.phase === 'error' && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {state.unauthenticated ? (
              <>
                You need an account to play rated strangers.{' '}
                <Link
                  href="/login?return=%2Fplay"
                  className="font-medium underline underline-offset-2"
                >
                  Sign in
                </Link>
              </>
            ) : (
              state.message
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
