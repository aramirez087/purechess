# Session 18 Handoff — Post-Game Review Screen

## What Was Built

### Routes
- `apps/web/src/app/games/[gameId]/page.tsx` — SSR server component. Calls `getReview(gameId)`, calls `notFound()` on null, exports `generateMetadata` for SEO. Renders `<AppShell><ReviewClient game={review} /></AppShell>`.
- `apps/web/src/app/games/[gameId]/review-client.tsx` — `'use client'` orchestrator. Consumes `useGameReview` hook, renders board + metadata + move list + controls + PGN actions. Shows corrupt-game error state instead of crashing.

### Pure utility
- `apps/web/src/lib/replay.ts` — `replayToFen(moves, ply)` replays WireMove array from starting position using chess.js, returns FEN or `null` on invalid move. `validateReplay(moves, finalFen)` compares board+turn+castling+ep (first 4 FEN fields) of full replay against stored `finalFen`.

### Service (stub)
- `apps/web/src/services/game-review.service.ts` — `getReview(gameId: string): Promise<GameReview | null>`. Returns hardcoded mock data for `gameId === 'demo-game-001'`; attempts `GET ${API_INTERNAL_URL}/games/:id` for real IDs (falls back to null on fetch error or 404). Env key: `API_INTERNAL_URL` (defaults to `http://localhost:4000`).

### Hook
- `apps/web/src/hooks/use-game-review.ts` — `useGameReview(game)` manages `currentPly` state (0 = start, N = after move N). Derives `fen` via `replayToFen`, `lastMove` from `moves[ply-1].uci`, `isCorrupt` via `validateReplay`. Exposes: `ply`, `fen`, `lastMove`, `isCorrupt`, `goTo`, `goNext`, `goPrev`, `goStart`, `goEnd`.

### Review components
- `apps/web/src/components/review/review-metadata.tsx` — White/black username+rating, result string, termination reason, time control badge, rated/casual badge, date.
- `apps/web/src/components/review/review-move-list.tsx` — Scrollable move pair list (1. e4 e5, 2. Nf3 Nc6…). Current ply bold + auto-scroll via `scrollIntoView`. Click-to-seek via `onSeek(ply)` prop.
- `apps/web/src/components/review/review-controls.tsx` — ⏮ ← → ⏭ buttons. Global `window.addEventListener('keydown')` for ArrowLeft/Right/Up/Down + Home/End/PageUp/PageDown. Keyboard shortcuts active anywhere on page.
- `apps/web/src/components/review/pgn-actions.tsx` — Copy PGN (navigator.clipboard + sonner toast). Download PGN (Blob `text/plain`, `purchess-<gameId>.pgn`).

### Types
- `apps/web/src/types/game-review.ts` — `GameReview`, `ReviewPlayer` interfaces (web-local, not in shared package).

### Vitest config update
- Added `@purchess/shared` → `../../packages/shared/src/index.ts` alias so tests can directly import shared enums/types without requiring a dist build.

## Verification Evidence

```
# All tests (80 total, 13 new review tests)
cd apps/web && pnpm test
→ Test Files  10 passed (10)
→ Tests  80 passed (80)

# TypeScript (web only — API pre-existing Prisma errors not introduced here)
cd apps/web && pnpm typecheck
→ exit 0

# ESLint
cd apps/web && pnpm lint
→ ✔ No ESLint warnings or errors
```

Note: `pnpm typecheck` at monorepo root fails on `apps/api` due to Prisma client not generated (pre-existing condition). Fixed by running `pnpm --filter @purchess/shared build` to produce `packages/shared/dist/` (required for web typecheck to resolve `@purchess/shared`).

## Open Issues / Known Gaps

- **API stub**: `GET /games/:id` is not implemented in `apps/api`. The service returns mock data for `demo-game-001`. Next session owning GamesModule must implement `GET /games/:id` returning `GameReview`-shaped JSON (see `GameReview` interface in `apps/web/src/types/game-review.ts`).
- **Board orientation**: White is always on bottom in review. No flip button. Can add later.
- **`?ply=N` permalink**: Not implemented (out of scope for MVP). To add: read `searchParams.ply` in `review-client.tsx` on mount and call `goTo(parseInt(ply))` as initial state.
- **Sentry integration**: `replayToFen` returns null on corruption but does not log to Sentry (not yet integrated). Left as a TODO in handoff, not in code.
- **Lighthouse perf**: Not measurable in CI (no headless browser). SSR shell ensures initial paint is fast; no client JS until hydration.

## Inputs Downstream Sessions Can Rely On

### Paths
- Review page: `apps/web/src/app/games/[gameId]/page.tsx`
- Review client: `apps/web/src/app/games/[gameId]/review-client.tsx`
- Review components: `apps/web/src/components/review/{review-metadata,review-move-list,review-controls,pgn-actions}.tsx`
- Replay util: `apps/web/src/lib/replay.ts`
- Review hook: `apps/web/src/hooks/use-game-review.ts`
- Service stub: `apps/web/src/services/game-review.service.ts`
- Types: `apps/web/src/types/game-review.ts`

### Exported symbols
```ts
// Stable service contract
import { getReview } from '@/services/game-review.service';
// Returns: Promise<GameReview | null>

// Reusable components (usable by Session 14 active-game page)
import { ReviewMoveList } from '@/components/review/review-move-list';
// Props: { moves: WireMove[]; currentPly: number; onSeek: (ply: number) => void }

import { ReviewControls } from '@/components/review/review-controls';
// Props: { onStart; onPrev; onNext; onEnd: () => void }

// Pure util
import { replayToFen, validateReplay } from '@/lib/replay';
```

### Env keys
- `API_INTERNAL_URL` — base URL for API calls from server components (default: `http://localhost:4000`). Add to `.env.example`.

### Next session must
- Implement `GET /games/:id` in `apps/api` returning `GameReview`-shaped JSON.
- Session 14's game-over dialog should link to `/games/${gameId}`.
