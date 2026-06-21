'use client';

import { useEffect, useState } from 'react';
import { lazyCaptureException } from '@/lib/sentry-lazy';
import '@/app/globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The capture forces the lazy SDK load, so even a pre-idle crash reports.
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void lazyCaptureException(error).then((id) => {
      if (live) setEventId(id);
    });
    return () => {
      live = false;
    };
  }, [error]);

  function handleCopy() {
    const text = eventId ?? error.digest ?? error.message;
    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 py-6 text-center font-sans text-foreground">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Purechess</p>
        <h2 className="font-display m-0 text-[1.75rem] font-medium italic tracking-[-0.01em]">
          Something broke.
        </h2>
        <div aria-hidden="true" className="h-px w-10 bg-brass/60" />
        <p className="m-0 text-sm text-muted-foreground">Refresh to try again.</p>
        {eventId && (
          <p className="m-0 font-mono text-xs text-muted-foreground">{eventId}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="chrome-btn rounded-md border px-4 py-2 text-sm"
          >
            Copy error details
          </button>
          <button
            onClick={reset}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}