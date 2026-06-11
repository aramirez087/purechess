import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  /** Mono small-caps line above the headline. */
  eyebrow?: string;
  /** Italic display headline in the house voice, e.g. "Something broke." */
  headline: string;
  description?: string;
  /** Action slot: bone primary first, ghost secondary after. */
  actions?: ReactNode;
  /** Sentry event id / Next error digest, shown as a selectable mono chip. */
  eventId?: string | null;
  className?: string;
}

/**
 * House-voice state screen for errors and empty terminal states. Token-based
 * (background/surface/brass) so it follows the active theme. No client hooks —
 * safe in both server and client components.
 */
export function ErrorState({
  eyebrow = 'Purechess',
  headline,
  description,
  actions,
  eventId,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 bg-background px-6 py-12 text-center',
        className,
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl italic tracking-tight text-foreground sm:text-4xl">
        {headline}
      </h2>
      <div className="h-px w-10 bg-brass/60" aria-hidden="true" />
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {eventId && (
        <p className="select-all rounded-md border border-border/70 bg-raised px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {eventId}
        </p>
      )}
      {actions && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      )}
    </div>
  );
}
