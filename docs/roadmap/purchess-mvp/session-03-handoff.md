# Session 03 Handoff — Design System & UI Foundation

## What Was Built

### Dependencies added (`apps/web/package.json`)
- `geist` — Geist Sans + Geist Mono fonts (local, no network request)
- `next-themes` — theme provider with system preference + localStorage
- `sonner` — toast notifications
- `clsx` + `tailwind-merge` — class merging utilities
- `class-variance-authority` + `lucide-react` — shadcn/ui requirements

### Config files
- `apps/web/components.json` — shadcn/ui config: default style, CSS variables, RSC, alias `@/components`, `@/lib/utils`
- `apps/web/tailwind.config.ts` — extended with: `darkMode: ['selector', '[data-theme="dark"]']`, full color palette (`card`, `popover`, `destructive`, `success`, `warning`), font families (`--font-geist-sans`, `--font-geist-mono`), spacing token `top-bar`

### Design tokens (`apps/web/src/app/globals.css`)
Light/dark CSS variable palette:
- Neutral monochrome base: `--background 0 0% 98%` (light) / `0 0% 7%` (dark)
- Brand accent: `--accent: 43 96% 56%` (warm gold, same in both themes)
- Semantic: `--destructive`, `--success`, `--warning`
- Tight radius: `--radius: 0.25rem`
- Dark mode triggers: `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])` for pre-hydration SSR, then `[data-theme="dark"]` for next-themes post-hydration
- Utilities: `.tabular-nums` with `font-feature-settings: 'tnum'`
- Focus ring via `:focus-visible`, selection color via `::selection`

### Fonts (`apps/web/src/app/layout.tsx`)
- `GeistSans` from `geist/font/sans` → CSS var `--font-geist-sans`
- `GeistMono` from `geist/font/mono` → CSS var `--font-geist-mono`
- Both applied to `<html>` via `className`; `suppressHydrationWarning` on `<html>`
- Skip-to-content `<a href="#main-content">` for a11y

**Decision deviation**: Plan called for JetBrains Mono via `next/font/google`. Used Geist Mono instead (same `geist` package, avoids network request, same monospaced quality). Downstream sessions should use `font-mono` Tailwind class for clocks/notation.

### shadcn/ui primitives (`apps/web/src/components/ui/`)
Installed via `pnpm dlx shadcn@latest add ... --overwrite --yes`:
- button, card, input, label, dialog, dropdown-menu, avatar, skeleton, separator, sheet, tooltip, tabs, badge, scroll-area, sonner

### Theme system
- `apps/web/src/components/theme-provider.tsx` — re-exports `ThemeProvider` from `next-themes`
- `apps/web/src/app/providers.tsx` — wraps `ThemeProvider` (outermost), `QueryClientProvider`, `Toaster` (sonner)
- Attribute: `data-theme` on `<html>`; default: `"system"`; persists in localStorage

### App shell (`apps/web/src/components/layout/`)
- `Logo.tsx` — text wordmark "Purchess", `className` prop
- `UserMenu.tsx` — DropdownMenu with Avatar fallback; shows login link when `user=null`
- `MobileNav.tsx` — Sheet-based, internal open state, "Menu" text trigger (no icon), nav links Play/Games/Profile
- `AppShell.tsx` — `variant: "default" | "minimal"`, `h-12` top bar with Logo + nav + UserMenu + MobileNav; `id="main-content"` on `<main>`
- `MarketingPage.tsx` — centered layout primitive: `max-w-4xl mx-auto px-6 py-12`

### Error/loading states
- `apps/web/src/app/loading.tsx` — renders `<LoadingShell />`
- `apps/web/src/app/error.tsx` — `'use client'`, reset button
- `apps/web/src/app/not-found.tsx` — "Page not found" + home link
- `apps/web/src/components/LoadingShell.tsx` — skeleton top bar + content skeleton
- `apps/web/src/components/ErrorBoundary.tsx` — React class component with `getDerivedStateFromError`

### Utilities (`apps/web/src/lib/utils.ts`)
- `cn(...inputs)` — clsx + tailwind-merge
- `formatDuration(ms)` — `M:SS` format
- `formatRelativeTime(date)` — "just now" / "Xm ago" / "Xh ago" / "Xd ago"
- `clampRatingDelta(n)` — clamps to [-400, 400]

### Smoke test page
- `apps/web/src/app/(demo)/demo/page.tsx` → URL: `/demo`
- Renders all shadcn primitives, theme switcher, utility demos, tabular-nums clock demo

## Verification Evidence

```
# Web-only typecheck (worktree; API deps not installed — pre-existing gap)
cd apps/web && pnpm typecheck
→ 0 errors

# Web lint
cd apps/web && pnpm lint
→ ✔ No ESLint warnings or errors
```

Note: `pnpm typecheck` at monorepo root fails on `apps/api` due to missing node_modules in this worktree (pre-existing condition from worktree isolation, not introduced by session 03). All files in scope of this session typecheck clean.

## Open Issues / Known Gaps

- `apps/web/src/stores/ui.store.ts` has `theme: 'light' | 'dark'` state which is now redundant — next-themes owns theme state. This file is outside session 03 scope. A future session should remove `theme`/`setTheme` from the Zustand store and replace any consumers with `useTheme()` from next-themes.
- Lighthouse a11y score not measured (no headless browser in this environment). Layout has skip-to-content link, focus rings, semantic HTML, ARIA via shadcn primitives.
- `AppShell` passes `user={null}` always (login state not wired). Auth session will replace this with real user data.
- `MobileNav` uses `<a>` tags, not Next.js `<Link>` — intentional for now since auth routing not defined. Replace with `<Link>` when auth routes are finalized.
- `lucide-react` installed as shadcn dependency; used only in shadcn-generated components (Dialog X, DropdownMenu chevron, Sheet X, Sonner icons). Custom code must not use lucide icons per design aesthetic.

## Inputs Downstream Sessions Can Rely On

### Paths
- shadcn/ui components: `apps/web/src/components/ui/*`
- Layout shell: `apps/web/src/components/layout/{AppShell,MarketingPage,Logo,UserMenu,MobileNav}.tsx`
- Utilities: `apps/web/src/lib/utils.ts`
- Theme provider: `apps/web/src/components/theme-provider.tsx`

### Exported symbols
- `cn`, `formatDuration`, `formatRelativeTime`, `clampRatingDelta` from `@/lib/utils`
- `AppShell` (`variant: "default" | "minimal"`) from `@/components/layout/AppShell`
- `MarketingPage` from `@/components/layout/MarketingPage`
- `Logo`, `UserMenu`, `MobileNav` from `@/components/layout/*`
- `ThemeProvider` from `@/components/theme-provider`
- `ErrorBoundary` from `@/components/ErrorBoundary`
- `LoadingShell` from `@/components/LoadingShell`
- All shadcn primitives from `@/components/ui/*`

### Design conventions
- Dark mode: `darkMode: ['selector', '[data-theme="dark"]']` in Tailwind — `dark:` variants work automatically
- Font: `font-mono tabular-nums` for clocks, ratings, SAN notation
- Color: `bg-background text-foreground border-border text-muted-foreground` — no hardcoded hex
- Accent (warm gold): `bg-accent text-accent-foreground` — primary CTAs and active states only
- Radius: `0.25rem` base — dense chess UI aesthetic
- Every page wraps in `<AppShell>` (variant prop controls top bar visibility)

### Env keys
No new env keys added in session 03.
