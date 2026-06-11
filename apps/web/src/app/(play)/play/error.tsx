'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';

export default function PlayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      // /play renders without the 3.5rem app header, so use the full viewport.
      className="min-h-[100dvh]"
      headline="Something broke."
      description="The play lobby failed to load. Try again, or head home."
      eventId={error.digest}
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
