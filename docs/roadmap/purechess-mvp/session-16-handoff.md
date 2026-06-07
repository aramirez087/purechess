# Session 16 Handoff — Homepage

## What Was Built

### New files
- `apps/web/src/lib/seo.ts` — `buildMetadata()` helper + `SITE_URL` constant from `NEXT_PUBLIC_SITE_URL`
- `apps/web/src/components/home/cta-button.tsx` — `<CtaButton variant="primary|secondary|tertiary">` wrapping shadcn Button + Next.js Link
- `apps/web/src/components/home/hero.tsx` — Hero section: h1 wordmark, tagline, three CTAs with tooltip on disabled "Analyze" button
- `apps/web/src/components/home/trust-strip.tsx` — Four trust statements with hairline dividers
- `apps/web/src/components/home/footer.tsx` — Minimal footer: Logo left, nav links center, copyright right
- `apps/web/test/home/homepage.test.tsx` — 9 Vitest + RTL tests

### Modified files
- `apps/web/src/app/page.tsx` — Replaced stub with `AppShell variant="minimal"` + Hero + TrustStrip + Footer + SEO metadata
- `apps/web/tailwind.config.ts` — Added `keyframes.fadeIn` + `animation.fade-in` (no new deps)
- `.env.example` — Added `NEXT_PUBLIC_SITE_URL=https://purechess.com`

### Key decisions
- `AppShell variant="minimal"` — homepage h1 IS the page identity; top nav would duplicate wordmark
- Query param `?mode=casual` not localStorage — zero client JS on homepage; `/play` page reads this param
- Disabled "Analyze" CTA uses `<span tabIndex={0}>` wrapper around disabled button to keep tooltip keyboard-accessible
- `new Date().getFullYear()` in footer Server Component — no hydration mismatch
- OG image `/og-image.png` is a placeholder path; static asset not in scope this session

## Verification Evidence

```
# Lint
cd apps/web && pnpm lint
→ ✔ No ESLint warnings or errors

# Tests (Vitest)
pnpm test
→ Test Files  6 passed (6)
→ Tests  47 passed (47)

# Typecheck
cd apps/web && pnpm typecheck
→ 0 errors in new session-16 files
→ Pre-existing errors: @purechess/shared not built in worktree (board components, demo page)
  — same pre-existing condition documented in session-03 and session-12 handoffs
```

## Open Issues / Known Gaps

- `/og-image.png` does not exist yet; OG image will show broken until a real asset is added. Downstream session should add a static PNG at `apps/web/public/og-image.png`.
- The "Analyze a game" CTA is disabled with tooltip "Coming soon". No `/games/upload-paste` route exists in MVP. A future session can enable this by adding the route and removing `disabled` from `<CtaButton>`.
- Lighthouse CI not automated (no headless browser in session environment). The page is fully SSR, zero client JS for static content, Geist fonts are local — Perf ≥ 95 expected. Manual verification required.
- `/about`, `/terms`, `/privacy` footer links are placeholders (no pages created). Intentional for MVP — they can be simple MDX pages in a future session.

## Inputs Downstream Sessions Can Rely On

### Paths
- SEO helper: `apps/web/src/lib/seo.ts`
- Home components: `apps/web/src/components/home/{hero,trust-strip,footer,cta-button}.tsx`

### Exported symbols
- `buildMetadata(input: BuildMetadataInput): Metadata` from `@/lib/seo`
- `SITE_URL: string` from `@/lib/seo`
- `CtaButton` (`variant: 'primary' | 'secondary' | 'tertiary'`, `href?`, `disabled?`) from `@/components/home/cta-button`
- `Hero`, `TrustStrip`, `Footer` from `@/components/home/*`

### Env keys
- `NEXT_PUBLIC_SITE_URL` — canonical base URL; defaults to `https://purechess.com` if not set

### Contract for `/play` page (session 13)
The "Play now" CTA links to `/play?mode=casual`. The `/play` page must read `searchParams.mode` and default to casual matchmaking when `mode=casual` is present.
