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
