---
depends_on: [03]
touches:
  - "apps/web/src/app/page.tsx"
  - "apps/web/src/components/landing/**"
  - "apps/web/src/components/landing/hero.tsx"
  - "apps/web/src/components/landing/trust-strip.tsx"
  - "apps/web/src/components/landing/footer.tsx"
  - "apps/web/src/components/landing/cta-button.tsx"
  - "apps/web/src/lib/seo.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 16: Landing Page

## Mission

Build the homepage. This is the very first thing every visitor sees. It must communicate "pure chess, nothing else" in one glance and get a user into a game in one click.

No marketing fluff. No long copy. No "as seen in" badges. Just a clear hero, three actions, and four trust statements.

## Tasks

1. **Hero** (`hero.tsx`):
   - Wordmark "Purchess" prominent.
   - Tagline: "Pure chess. Nothing else."
   - Three primary actions (stacked on mobile, side-by-side on desktop):
     - **Play now** (primary, full-width on mobile) → `/play` with `mode=casual` query.
     - **Create account** (secondary) → `/register`.
     - **Analyze a game** (tertiary, smaller) → `/games/upload-paste` (placeholder for future; for MVP, disabled with tooltip "Coming soon" if the analyzer isn't built, OR if we want it usable, link to `/games` to see recent rated games the user can review).
   - Subtle entrance: opacity fade-in, no scroll-jacking.
2. **Trust strip** (`trust-strip.tsx`):
   - Four short statements in a row (wrap on mobile):
     - **Fast matchmaking**
     - **Clean board**
     - **Free to start**
     - **No distractions**
   - No icons. Just text, hairline-divided.
3. **Footer** (`footer.tsx`):
   - Minimal: copyright, links to `/about`, `/terms`, `/privacy` (placeholders, not full pages in MVP — they can be simple static MDX or even just `#` for now).
   - Wordmark on the left, links on the right.
4. **SEO** (`lib/seo.ts`):
   - Helper to build Next.js `Metadata` objects.
   - Homepage metadata: title "Purchess — Pure chess. Nothing else.", description "The cleanest way to play chess online. No ads, no clutter, just a great board.", canonical URL.
   - Open Graph: title, description, type=website, image (Purchess wordmark on neutral background).
   - Twitter card: `summary_large_image`.
5. **Performance**:
   - Server-rendered, no client JS needed for the static parts. The hero CTAs are links; the "Play now" link can be enhanced with a tiny inline script to set the matchmaking mode via localStorage so the `/play` page starts in casual mode.
   - Hero font is Geist Sans; tagline and trust strip are slightly larger than body but not gigantic.
   - Initial paint < 1s on a 3G connection.
6. **No distractions enforcement**:
   - No news feed, no ads, no chat preview, no puzzles, no banner for tournaments.
   - The page must be reviewable in a single glance: title, tagline, three buttons, four statements, footer.
7. **Anonymous-friendly**:
   - All three CTAs are usable by anonymous users. "Play now" goes into casual matchmaking without requiring auth. "Create account" goes to `/register`. "Analyze a game" is allowed (if implemented); for MVP, ship a stub that explains it's coming.
8. **Dark mode**:
   - Page respects the global theme from Session 03. Tested in light and dark.
9. **Accessibility**:
   - Single `<h1>` for the wordmark (or set the wordmark as a `<h1>` and tagline as a `<p>`).
   - All buttons are `<Link>` or `<button>` with clear focus rings.
   - Color contrast ≥ 4.5:1.
10. **Tests**:
    - Renders wordmark, tagline, three CTAs, four trust statements, footer.
    - CTAs link to correct routes.
    - No telemetry/analytics calls in dev (mock and assert no third-party requests).
    - Lighthouse perf ≥ 95, a11y ≥ 95.
11. **Verification**:
    - Visual review on desktop (1440px), tablet (768px), mobile (375px).
    - All links navigate correctly.

## Deliverables

- `app/page.tsx` rendering the hero, trust strip, footer.
- Reusable `<CtaButton>` with `variant: 'primary' | 'secondary' | 'tertiary'`.
- SEO metadata configured.
- A11y and Lighthouse targets met.

## Notes for Downstream Sessions

- The "Analyze a game" CTA is a stub for MVP. If we want it functional, it can link to a paste-PGN page (out of scope for MVP but trivial to add later).
- The hero is the only place we mention positioning copy. Other pages assume context.
- Do not add a "language switcher" or region picker in MVP.
- The footer links to `/about`, `/terms`, `/privacy` are placeholders. If we ship real pages later, they live in the same `app/` router.
