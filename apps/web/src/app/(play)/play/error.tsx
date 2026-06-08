'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

export default function PlayError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">This page failed to load</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Try again, or head back home.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
        <Button
          size="sm"
          asChild
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          <Link href="/">
            <Home className="mr-1.5 h-3.5 w-3.5" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
