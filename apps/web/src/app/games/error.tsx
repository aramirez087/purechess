'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';

export default function GamesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      headline="Something broke."
      description="Your games failed to load. Try again, or head home."
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
