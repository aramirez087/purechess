import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TrainingPlaceholderProps = {
  /** Lucide icon for the surface (Target / GraduationCap / Castle ...). */
  icon: LucideIcon;
  /** Mono brass eyebrow, e.g. "Improve". */
  eyebrow: string;
  /** Fraunces headline. */
  title: string;
  /** One-line description under the headline. */
  description: string;
  /** The concrete things coming to this surface — never lorem. */
  upcoming: string[];
  /** Shown when the surface needs auth and the visitor is signed out. */
  signedOut?: boolean;
  /** Optional sibling links rendered as quiet pills (e.g. to /puzzles). */
  related?: { href: string; label: string }[];
};

/**
 * Shared empty-state for the Improve route shells (/train, /openings,
 * /endgames). Silent Tournament voice: mono brass eyebrow, Fraunces headline,
 * low-contrast borders, one brass accent, AA-floor muted text. No new visual
 * language — mirrors the games/profile page chrome.
 */
export function TrainingPlaceholder({
  icon: Icon,
  eyebrow,
  title,
  description,
  upcoming,
  signedOut = false,
  related,
}: TrainingPlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-14 sm:py-20 flex flex-col gap-8">
      <header className="animate-rise flex flex-col items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-[10px]',
            'border border-border/70 bg-raised text-brass',
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">{eyebrow}</p>
          <h1 className="mt-1.5 font-display text-3xl tracking-[-0.01em] sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>
        </div>
      </header>

      <section
        className={cn(
          'animate-rise-1 rounded-[14px] border border-border/70 bg-surface',
          'p-6 sm:p-7',
        )}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
          Coming together
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {upcoming.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
              <span
                aria-hidden="true"
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass/80"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {signedOut ? (
          <div className="mt-6 border-t border-border/60 pt-5">
            <p className="text-sm text-muted-foreground">
              Training tracks your progress, so it needs an account.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/login?return=/train"
                className={cn(
                  'inline-flex h-9 items-center rounded-md bg-brass px-4 text-sm font-medium',
                  'text-stage transition-opacity hover:opacity-90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                )}
              >
                Sign in
              </Link>
              <Link
                href="/puzzles"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Try today&rsquo;s daily puzzle
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {related && related.length > 0 ? (
        <nav aria-label="Related training" className="animate-rise-2 flex flex-wrap gap-2.5">
          {related.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex h-8 items-center rounded-md border border-border/70 bg-raised px-3',
                'text-xs font-medium text-muted-foreground transition-colors',
                'hover:border-brass/50 hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
