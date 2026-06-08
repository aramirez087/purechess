import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-raised text-brass">
        <Compass className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Back to home
      </Link>
    </div>
  );
}
