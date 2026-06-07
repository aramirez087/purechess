import { Skeleton } from '@/components/ui/skeleton';

export function LoadingShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-12 border-b border-border bg-background flex items-center px-4 gap-6 shrink-0">
        <Skeleton className="h-4 w-20" />
        <div className="hidden sm:flex gap-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
