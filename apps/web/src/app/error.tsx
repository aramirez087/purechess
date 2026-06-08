'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const eventId = Sentry.lastEventId();

  function handleCopy() {
    const text = eventId ?? error.digest ?? error.message;
    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The page failed to render. Refresh to try again.
        </p>
      </div>
      {(eventId ?? error.digest) && (
        <p className="rounded-md border border-border/70 bg-raised px-3 py-1.5 text-xs text-muted-foreground font-mono">
          {eventId ?? error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          Copy error details
        </Button>
        <Button size="sm" onClick={reset} className="bg-foreground text-background hover:bg-foreground/90">
          <RotateCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
