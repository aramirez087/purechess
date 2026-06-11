import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-md bg-muted ring-1 ring-inset ring-white/[0.02]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
