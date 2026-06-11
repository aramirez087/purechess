import { Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-top-bar border-b border-border/70 bg-background/80 backdrop-blur-md flex items-center px-4 sm:px-6 gap-6 shrink-0">
        <Skeleton className="h-7 w-28" />
        <div className="hidden sm:flex gap-1">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-7 w-14" />
        </div>
        <div className="ml-auto flex gap-1">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
        </div>
      </div>
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-brass/40 bg-brass/10 text-brass animate-brass-pulse">
          <Crown className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Purechess
        </p>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
