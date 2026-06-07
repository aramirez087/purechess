---
depends_on: [01]
touches:
  - "apps/web/tailwind.config.ts"
  - "apps/web/postcss.config.js"
  - "apps/web/src/app/globals.css"
  - "apps/web/src/app/layout.tsx"
  - "apps/web/src/components/ui/**"
  - "apps/web/src/components/layout/**"
  - "apps/web/src/lib/utils.ts"
  - "apps/web/components.json"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 03: Design System & UI Foundation

## Mission

Build the visual and component foundation for Purchess: design tokens, the shadcn/ui setup, core primitives (Button, Card, Input, Label, Dialog, Toast, Dropdown, Avatar, Skeleton, Spinner), the global layout shell, and the theme system (light/dark with system preference). Every later frontend session will compose from this.

The aesthetic: **calm, dense, monochrome, typographic**. No gradients. No drop shadows beyond a single hairline. Generous whitespace. No icons unless they earn it.

## Tasks

1. **Tailwind config** (`apps/web/tailwind.config.ts`):
   - CSS variables for colors, not hardcoded hex.
   - Palette: neutral base (`--background`, `--foreground`, `--muted`, `--border`, `--accent`), single brand accent (a calm green or warm gold — choose one), semantic (`--destructive`, `--success`, `--warning`).
   - Type scale tuned for chess UI: tight line-height, monospaced numerals for clocks.
   - Spacing scale, radius scale, font family.
   - `font-feature-settings: 'tnum'` on clock-like elements.
2. **shadcn/ui setup**:
   - `components.json` configured for `src/components/ui`, RSC + tailwind.
   - Run `pnpm dlx shadcn@latest init` and add: button, card, input, label, dialog, dropdown-menu, toast, avatar, skeleton, separator, sheet, tooltip, tabs, badge, scroll-area.
3. **Global styles** (`apps/web/src/app/globals.css`):
   - CSS variable definitions for light + dark themes.
   - Default dark mode triggered by `prefers-color-scheme` and overridable by `[data-theme="dark"]` on `<html>`.
   - Base reset, focus rings, selection color.
4. **Theme provider**:
   - `apps/web/src/components/theme-provider.tsx` (client component) using `next-themes` with `attribute="data-theme"`, `defaultTheme="system"`, `enableSystem`.
   - Persists in localStorage.
5. **Global layout** (`apps/web/src/app/layout.tsx`):
   - Inter or Geist Sans for body, JetBrains Mono (or Geist Mono) for clocks/notation.
   - `<ThemeProvider>` wraps the tree.
   - Skip-to-content link for a11y.
6. **App shell** (`apps/web/src/components/layout/`):
   - `AppShell.tsx` — top bar with logo (wordmark "Purchess"), minimal nav (Play, Profile, Games, Login/Logout), no sidebar.
   - `MobileNav.tsx` — sheet-based nav for narrow screens.
   - `UserMenu.tsx` — dropdown for logged-in users.
   - `Logo.tsx` — text wordmark, no SVG art.
7. **Core utilities** (`apps/web/src/lib/utils.ts`):
   - `cn()` (shadcn's class merger).
   - `formatDuration(ms)`, `formatRelativeTime(date)`, `clampRatingDelta(n)` helpers.
8. **Toast/notification system** using shadcn `sonner` (or `toast`).
9. **Loading and error states**:
   - `<LoadingShell />` for route loading.
   - `<ErrorBoundary />` client component.
   - 404 page and global `error.tsx`.
10. **Smoke checks**:
    - Layout renders with theme switching working (light/dark/system).
    - All shadcn primitives compile and render in a test page.
    - Mobile nav opens and closes.
    - Fonts load with `font-display: swap`.
    - Lighthouse accessibility score ≥ 95 on the layout.

## Deliverables

- Working theme system (light + dark + system).
- shadcn/ui primitives installed and styled to match the calm aesthetic.
- App shell with minimal nav usable on desktop and mobile.
- Global fonts, base styles, helpers.
- A `<MarketingPage>` layout primitive (centered, max-width, generous padding) reused by landing/profile/review.

## Notes for Downstream Sessions

- All UI must compose from `src/components/ui/*` — no ad-hoc styled components.
- Color usage rule: prefer `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`. Accent color (`bg-accent` / `text-accent-foreground`) is reserved for primary CTAs and active states.
- Clocks and SAN notation **must** use the monospace font (`font-mono`) with `tabular-nums`.
- The app shell's `AppShell` exposes a `variant` prop: `"default" | "minimal"` (minimal hides the top bar for `/play/:gameId` fullscreen).
- For consistency, every page wraps in `<AppShell>` from the layout, not per page.
