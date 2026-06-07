'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">Refresh to try again.</p>
      {(eventId ?? error.digest) && (
        <p className="text-xs text-muted-foreground font-mono">
          Error ID: {eventId ?? error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          Copy error details
        </Button>
        <Button size="sm" onClick={reset}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
