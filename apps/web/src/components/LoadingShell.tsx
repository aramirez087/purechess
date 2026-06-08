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
      <div className="flex-1 px-4 sm:px-6 py-10 mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}
