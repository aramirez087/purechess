'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { lazyCaptureException } from '@/lib/sentry-lazy';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';

export default function Error({
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

  return (
    <ErrorState
      headline="Something broke."
      description="The page failed to render. Try again, or head home."
      eventId={eventId ?? error.digest}
      actions={
        <>
          <Button
            size="sm"
            onClick={reset}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            Try again
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </>
      }
    />
  );
}
