'use client';

import { cn } from '@/lib/utils';

export interface GameRailProps {
  /** Uppercase tracked header label, e.g. "Moves". Omit for a header-less panel. */
  title?: string;
  /** Right-aligned header content, e.g. "12 ply". */
  aside?: React.ReactNode;
  /**
   * Masthead slot rendered above the title row (brand row, status zone…),
   * separated from the rest of the panel by a hairline.
   */
  header?: React.ReactNode;
  /** Docked control row pinned under the body, separated by a hairline. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Classes for the body wrapper (e.g. scroll behavior). */
  bodyClassName?: string;
  className?: string;
}

export function GameRail({
  title,
  aside,
  header,
  footer,
  children,
  bodyClassName,
  className,
}: GameRailProps) {
  return (
    <div className={cn('chrome-panel flex flex-col overflow-hidden', className)}>
      {header && <div className="shrink-0 border-b border-border">{header}</div>}
      {title && (
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </h2>
          {aside && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{aside}</span>
          )}
        </div>
      )}
      <div className={cn('min-h-0', bodyClassName)}>{children}</div>
      {footer && <div className="shrink-0 border-t border-border">{footer}</div>}
    </div>
  );
}