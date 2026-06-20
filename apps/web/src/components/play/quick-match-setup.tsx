'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Cpu, Loader2, Zap } from 'lucide-react';
import { MATCHMAKING_TIME_CONTROLS } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeControlPicker, StakesPicker } from '@/components/play/time-control-picker';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { useSettingsStore } from '@/stores/settings-store';
import { clampTimeControlIndex } from '@/lib/play-preferences';

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type QuickMatchSetupProps = {
  /** Join the queue immediately on mount — the 1-click play path. */
  autoStart?: boolean;
  /** Login return URL when matchmaking needs auth. */
  loginReturn?: string;
};

export function QuickMatchSetup({ autoStart = false, loginReturn = '/play' }: QuickMatchSetupProps) {
  const router = useRouter();
  const playPreferences = useSettingsStore((s) => s.playPreferences);
  const updateSettings = useSettingsStore((s) => s.update);
  const [selectedTimeControl, setSelectedTimeControl] = useState(() =>
    clampTimeControlIndex(playPreferences.timeControlIndex),
  );
  const [rated, setRated] = useState(playPreferences.rated);
  const { state, join, cancel } = useMatchmaking();
  const autoStartedRef = useRef(false);

  const persistPreferences = useCallback(
    (index: number, nextRated: boolean) => {
      updateSettings({
        playPreferences: {
          timeControlIndex: clampTimeControlIndex(index),
          rated: nextRated,
        },
      });
    },
    [updateSettings],
  );

  const startSearch = useCallback(async () => {
    const tc = MATCHMAKING_TIME_CONTROLS[selectedTimeControl]!;
    persistPreferences(selectedTimeControl, rated);
    await join({
      timeControlSeconds: tc.seconds,
      incrementSeconds: tc.increment,
      category: tc.category,
      rated,
    });
  }, [join, persistPreferences, rated, selectedTimeControl]);

  // Navigate as soon as the pairing lands (push or poll).
  useEffect(() => {
    if (state.phase === 'matched') {
      router.push(`/play/${state.gameId}`);
    }
  }, [state, router]);

  // 1-click path: queue as soon as the component mounts.
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startSearch();
  }, [autoStart, startSearch]);

  async function handleCancel() {
    await cancel();
    if (autoStart) {
      router.push('/play');
    }
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

  const loginHref = `/login?return=${encodeURIComponent(loginReturn)}`;

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
        <TimeControlPicker
          options={MATCHMAKING_TIME_CONTROLS}
          value={selectedTimeControl}
          onChange={(index) => {
            setSelectedTimeControl(index);
            persistPreferences(index, rated);
          }}
        />

        <StakesPicker
          rated={rated}
          onChange={(nextRated) => {
            setRated(nextRated);
            persistPreferences(selectedTimeControl, nextRated);
          }}
        />

        <div className="pt-2">
          <Button
            onClick={() => void startSearch()}
            className="h-11 w-full bg-foreground text-background hover:bg-foreground/90 shadow-elevated"
          >
            Find opponent
          </Button>
        </div>

        {state.phase === 'error' && (
          <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            {state.unauthenticated ? (
              <>
                <p>You need an account to play strangers online.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="h-8 bg-foreground text-background hover:bg-foreground/90">
                    <Link href={loginHref}>Sign in</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 border-border/80">
                    <Link href="/play?mode=computer">
                      <Cpu className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Play vs computer
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p>{state.message}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}