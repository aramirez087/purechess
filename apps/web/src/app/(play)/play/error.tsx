'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PlayError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">This page failed to load.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reset}>
          Retry
        </Button>
        <Button size="sm" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
