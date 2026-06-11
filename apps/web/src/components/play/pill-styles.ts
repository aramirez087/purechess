/**
 * Shared recipes for the selectable pills in the play setup pickers
 * (time presets, strength levels, colors). One active state (brass text on a
 * brass wash) and one hover state, so the pickers never drift apart.
 */
export const PILL_BASE =
  'rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const PILL_ACTIVE =
  'border-brass/70 bg-brass/15 font-semibold text-brass-text shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]';

export const PILL_INACTIVE =
  'border-border/60 bg-raised/40 text-muted-foreground hover:border-foreground/30 hover:bg-raised hover:text-foreground';

/**
 * Segmented-control recipes — the same brass selection grammar as the pills,
 * but for compact filter groups that must read as ONE control: the options
 * sit inside a single bordered track (SEGMENT_GROUP) and the active segment
 * is marked with a brass wash + inset brass ring instead of its own border.
 *
 * When to use which: PILL_* for free-standing choices in setup pickers
 * (each option is its own bordered chip); SEGMENT_* for dense filter rows
 * (e.g. the /games ledger filters) where a shared track keeps the group quiet.
 */
export const SEGMENT_GROUP =
  'inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-raised/40 p-0.5';

export const SEGMENT_BASE =
  'rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const SEGMENT_ACTIVE = 'bg-brass/15 text-foreground ring-1 ring-inset ring-brass/40';

export const SEGMENT_INACTIVE = 'text-muted-foreground hover:bg-raised hover:text-foreground';
