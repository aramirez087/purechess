'use client';

import { cn } from '@/lib/utils';

export interface GameRailProps {
  /** Uppercase tracked header label, e.g. "Moves". Omit for a header-less panel. */
  title?: string;
  /** Right-aligned header content, e.g. "12 ply". */
  aside?: React.ReactNode;
  children: React.ReactNode;
  /** Classes for the body wrapper (e.g. scroll behavior). */
  bodyClassName?: string;
  className?: string;
}

export function GameRail({ title, aside, children, bodyClassName, className }: GameRailProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[6px] border border-[#2b332c] bg-[#121511]',
        className,
      )}
    >
      {title && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#2b332c] px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9da79c]">{title}</h2>
          {aside && <span className="font-mono text-xs tabular-nums text-[#6f7a70]">{aside}</span>}
        </div>
      )}
      <div className={cn('min-h-0', bodyClassName)}>{children}</div>
    </div>
  );
}
