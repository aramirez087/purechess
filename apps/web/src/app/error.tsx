'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';

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
