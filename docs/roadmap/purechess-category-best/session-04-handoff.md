# Session 04 Handoff — Speed Shell

**Epic:** purechess-category-best · **Branch:** `epic/purechess-category-best--s04-speed-shell` · **Date:** 2026-06-11

---

## 1. What was done

1. **Bootstrapped** fresh worktree (`pnpm install` → shared build → `db:generate`).
2. **Measured baseline** — confirmed parity with session-01-handoff.md.
3. **PostHog deferral** — removed static `posthog-js` imports from `posthog-provider.tsx` and `home-viewed-tracker.tsx`; both now use `import('@/lib/posthog')` inside `useEffect` + `requestIdleCallback({ timeout: 2000 })`. Result: `/` dropped 63 kB (348 → 285 kB).
4. **Hero board LCP fix** — `hero-board.tsx` now adds `animate-rise-4` only after mount (`useState(false)` + `useEffect(() => setMounted(true), [])`). Before mount, the `<figure>` is `opacity:1` (no class) so it is immediately eligible as an LCP candidate.
5. **Sentry Replay lazy loading** — Removed `Sentry.replayIntegration()` from the synchronous `Sentry.init()` in `sentry.client.config.ts`. Added `Sentry.lazyLoadIntegration('replayIntegration')` via `requestIdleCallback` (3 s timeout). The rrweb-based replay chunk (`f71b5fc5`, 37.8 kB gzipped) is no longer bundled in shared-by-all. Error monitoring remains fully synchronous; session recordings start after the idle callback fires.
6. **Measured after** — full Lighthouse runs on `/`, `/games`, `/analyze`.

---

## 2. Before / after bundle measurements

| Route | Before | After | Target | Δ | Status |
|---|---|---|---|---|---|
| `/` | 348 kB | **247 kB** | ≤ 240 kB | −101 kB | 7 kB over |
| `/play` | 304 kB | **266 kB** | ≤ 240 kB | −38 kB | 26 kB over |
| `/games` | 294 kB | **256 kB** | ≤ 240 kB | −38 kB | 16 kB over |
| `/analyze` | 356 kB | **318 kB** | ≤ 250 kB | −38 kB | 68 kB over |
| `/play/[gameId]` | 297 kB | **259 kB** | ≤ 250 kB | −38 kB | 9 kB over |
| `/computer-game/[gameId]` | 283 kB | **245 kB** | ≤ 250 kB | −38 kB | ✅ HIT |
| **shared-by-all** | 204 kB | **166 kB** | ≤ 175 kB | −38 kB | ✅ HIT |

### Shared-by-all breakdown (after)

| Chunk | Size | Contents |
|---|---|---|
| `2693-*` | 109 kB | React + Next.js framework + core runtime |
| `6420bbf7-*` | 53.8 kB | Sentry core SDK |
| other | 3.15 kB | misc utilities |
| **total** | **166 kB** | |

The rrweb / Sentry Replay chunk (`f71b5fc5`, 37.8 kB) is **gone** from shared-by-all.

---

## 3. Lighthouse before / after

| Route | Metric | Before | After | Target |
|---|---|---|---|---|
| `/` | Perf | 78 | **82** | ≥ 95 |
| `/` | A11y | 95 | **95** | ≥ 95 ✅ |
| `/` | LCP | 6.3 s | **4.96 s** | ≤ 2.5 s |
| `/` | FCP | 1.1 s | **1.05 s** | |
| `/` | TBT | 20 ms | **12 ms** | |
| `/` | CLS | 0 | **0** | |
| `/games` | Perf | n/a | **75** | |
| `/games` | A11y | n/a | **100** | |
| `/games` | LCP | n/a | **6.93 s** | ≤ 2.5 s |
| `/analyze` | Perf | n/a | **79** | |
| `/analyze` | A11y | n/a | **100** | |
| `/analyze` | LCP | n/a | **5.93 s** | ≤ 2.5 s |

LCP across all routes remains above the 2.5 s target. See §5 for root cause and S07 tasks.

---

## 4. Decisions made (with why)

### D1: PostHog dynamic import via `requestIdleCallback`
PostHog was bundled into `/`'s route-specific chunk via a static `import` in `home-viewed-tracker.tsx` (only used on home page). Making it a dynamic import inside `useEffect` + `requestIdleCallback` removes it from the critical path and from the route's initial chunk. `posthog-js` queues `capture()` and `identify()` calls before `init()` — no events are lost with lazy init.

### D2: `posthog-provider.tsx` dynamic import
The provider's `initPostHog` and `identify` calls also moved to dynamic imports. The provider is in the root layout (all routes), so the posthog-js module is still preloaded as an async chunk for some routes (Next.js loadable manifest), but it no longer blocks the critical rendering path.

### D3: Hero board animation deferred to post-mount
`animate-rise-4` uses `animation-fill-mode: both` which sets the element to `opacity: 0` in the SSR HTML (the animation `from` state). This prevents the board from being an LCP candidate until JS hydrates. Adding `useState(false) + useEffect setMounted` defers the animation class to post-hydration. Before hydration the board is `opacity: 1` and immediately eligible as LCP. Progressive enhancement: users without JS always see the board.

### D4: Sentry Replay lazy via `lazyLoadIntegration`
`replayIntegration()` uses rrweb for DOM recording — a 37.8 kB gzipped chunk shared by all routes. Loading it lazily via `requestIdleCallback({ timeout: 3000 })` removes it entirely from shared-by-all. Core Sentry error capture is unaffected. The `lazyLoadIntegration` API (available since `@sentry/browser` v7.21) fetches the replay bundle from Sentry's CDN when idle.

### D5: Sentry core NOT lazy-loaded
The `6420bbf7` chunk (53.8 kB, Sentry core SDK) was NOT made lazy. This would require using `withSentryConfig({ disableClientInstrumentation: true })` and manually bootstrapping Sentry after hydration — complex and risky. Deferred to S07. See §5.

### D6: LCP `h1` animation fix NOT done
`hero.tsx` is a Server Component (no `'use client'`), and `components/**` is owned by S06 per the charter. All hero text elements (`h1`, `p`, badges) use `animate-rise-*` with `animation-fill-mode: both`, making them `opacity: 0` in SSR HTML. This is why Lighthouse reports LCP element as N/A — no text/image element has opacity > 0 at SSR time. Fixing this requires a Client Component wrapper in `hero.tsx` or changing the CSS fill-mode for LCP-critical elements. Filed for S06/S07 (see §5).

---

## 5. Open issues / S07 must-do

### 5.1 LCP still blocked — hero text animations
**Root cause:** All elements in `hero.tsx` (h1, subtitle, badge, CTA buttons) use `animate-rise-*` with `animation-fill-mode: both` from `globals.css`. The `both` fill-mode applies the `from: opacity: 0` state during the delay period, meaning the SSR HTML renders every hero element invisible. Lighthouse reports LCP element = N/A because nothing has non-zero opacity at first paint.

**S07 fix:** Two approaches (either works):
1. Wrap animated hero content in a `'use client'` component with a `mounted` state guard (same pattern as hero-board.tsx). The `h1` should be `opacity: 1` in SSR and receive the `animate-rise-2` class only post-mount.
2. Alternative: add `--animation-fill-mode: forwards` override for the LCP-critical elements in `globals.css` (`animate-rise-1`, `animate-rise-2`) — removes the backwards fill so elements are visible before animation starts. Requires S06 sign-off on globals.css.

The `h1` is the highest-impact fix since it's the largest text element and most likely LCP candidate.

**Files:** `apps/web/src/components/home/hero.tsx`, `apps/web/src/app/globals.css` (S06 owns globals.css)

### 5.2 Sentry core SDK — 53.8 kB remaining in shared
The `6420bbf7` chunk (Sentry SDK init + instrumentation) is the largest remaining lever in shared-by-all. Making it lazy:

```ts
// next.config.mjs — add to withSentryConfig options:
{
  disableClientInstrumentation: true,  // stops auto-injection
}
// Then in layout.tsx or a new instrumentation-client.ts:
// Dynamic import Sentry init after hydration
```

Or use the newer `instrumentation-client.ts` pattern (Sentry recommends this for Next.js 15+; v14 supports it with `instrumentationHook: true` experimental flag already enabled in `next.config.mjs`).

Estimated saving: −53.8 kB from shared-by-all → shared drops to ~112 kB.

**Files:** `apps/web/next.config.mjs`, `apps/web/sentry.client.config.ts`, new `apps/web/src/instrumentation-client.ts`

### 5.3 Routes still above First Load JS target

| Route | Current | Target | Gap | Next lever |
|---|---|---|---|---|
| `/` | 247 kB | ≤ 240 kB | 7 kB | Hero text wrapper (see 5.1) |
| `/play` | 266 kB | ≤ 240 kB | 26 kB | Sentry core (see 5.2) |
| `/games` | 256 kB | ≤ 240 kB | 16 kB | Sentry core (see 5.2) |
| `/analyze` | 318 kB | ≤ 250 kB | 68 kB | Sentry (38 kB) + chess.js split |
| `/play/[gameId]` | 259 kB | ≤ 250 kB | 9 kB | Sentry core (see 5.2) |

After Sentry lazy-init (saving 53.8 kB from shared): `/play` → 212, `/games` → 202, `/play/[gameId]` → 205 (all hit targets). `/analyze` → 264 kB (still 14 kB over — needs chess.js dynamic import).

### 5.4 Posthog chunk still preloaded for `/play` and `/analyze`
The `484fe0c7` posthog-js chunk (~50 kB gzipped) appears as `<script async>` in `/play.html` and `analyze.html`. This is from Next.js eagerly preloading dynamic imports in the React loadable manifest. It loads asynchronously (non-blocking), but it counts in "First Load JS". Preventing this preload would require either: (a) using `next/dynamic` with `ssr: false` for PostHogProvider, or (b) moving PostHogProvider out of the root layout to route-specific layouts. Low priority since it's async.

---

## 6. Files changed

| File | Change |
|---|---|
| `apps/web/src/components/posthog-provider.tsx` | Removed static `posthog-js` imports; `initPostHog` + `identify` + `reset` all deferred to `import('@/lib/posthog').then(...)` inside `useEffect` + `requestIdleCallback` |
| `apps/web/src/components/home/home-viewed-tracker.tsx` | Replaced static `posthog` import with `import('@/lib/posthog').then(...)` |
| `apps/web/src/components/home/hero-board.tsx` | Added `mounted` state; `animate-rise-4` class applied only post-mount |
| `apps/web/sentry.client.config.ts` | Removed `replayIntegration()` from sync `Sentry.init()`; added `lazyLoadIntegration('replayIntegration')` via `requestIdleCallback` |

---

## 7. Quality gates passed

| Gate | Result |
|---|---|
| `cd apps/web && pnpm exec tsc --noEmit` | ✅ clean |
| `cd apps/web && pnpm exec vitest run test/` | ✅ 256 tests pass (33 files) |
| `pnpm build` (repo root — shared first) | ✅ success |

---

## 8. Explicit inputs for S07

- **Sentry core lazy init:** See §5.2. Key files: `apps/web/next.config.mjs`, `apps/web/sentry.client.config.ts`. The `instrumentationHook: true` is already in next.config.mjs experimental flags — use `instrumentation-client.ts` pattern.
- **Hero text LCP fix:** See §5.1. Key file: `apps/web/src/components/home/hero.tsx`. Pattern: same `mounted` guard as `hero-board.tsx` (which now has the example). Coordinate with S06 on globals.css fill-mode change.
- **Lighthouse target:** `/` LCP ≤ 2.5 s requires both the hero text fix AND Sentry lazy. Together they should remove ~90 kB of blocking JS from critical path.
- **Measurement command:**
  ```bash
  cd apps/web && pnpm build
  PORT=3100 pnpm start &
  npx --yes lighthouse http://localhost:3100/ \
    --chrome-flags="--headless=new --no-sandbox" \
    --only-categories=performance,accessibility \
    --output=json --output-path=/tmp/lh-final.json
  ```
