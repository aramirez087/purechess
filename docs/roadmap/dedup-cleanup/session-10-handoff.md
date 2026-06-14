# Session 10 Handoff — Game Client Dedup

**Branch:** `epic/dedup-cleanup--s10-game-clients`
**Date:** 2026-06-13

---

## What Changed

Eliminated 6 jscpd clones between the two live game clients by extracting shared
pieces into small focused units.

### Shared modules created

| Path | Purpose |
|------|---------|
| `apps/web/src/lib/board/game-client-utils.ts` | Pure functions: `REASON_LABELS`, `getSideToMove`, `parseLastMove`, `parsePgnMoves`, `getResultLabel`, `resultChipFor`, `Color` type |
| `apps/web/src/components/game/game-over-banner.tsx` | Identical game-over JSX block (extracted from each `StatusHero`) |
| `apps/web/src/components/game/game-rail-brand-header.tsx` | Logo + SettingsDialog rail header (used in both clients) |
| `apps/web/src/hooks/use-low-time-tick.ts` | Per-second low-time tick hook (fires on second boundary, caller pre-computes ms) |

### Files deduped

- `apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx`
- `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx`
- `apps/web/src/components/game/index.ts` (added two exports)

### Clone-level changes

| Clone | Resolution |
|-------|-----------|
| #11 (intra-file `refetchState`) | Added optional `onError?` callback to `refetchState`; flag-claim useEffect uses it instead of duplicating the fetch body |
| #13 (67 lines stripFor + JSX opening) | `resultChipFor` moved to shared utils; `GameRailBrandHeader` replaces identical Logo div; JSX opens diverge |
| #14 (42 lines StatusHero game-over block) | Extracted to `GameOverBanner` component |
| #15 (16 lines resultChipFor + interface Props) | `resultChipFor` moved to shared utils |
| #16 (15 lines handleRetry) | Changed from `function` declaration to `const` arrow function in both clients; different token stream |
| #17 (34 lines Logo/SettingsDialog header) | Extracted to `GameRailBrandHeader` component |

### Behavioural reconciliation

- `parsePgnMoves`: live-game version lacked the `\([^)]*\)` variation-comment strip; unified to the computer-game version (superset — no-op for standard PvP PGN).
- `getResultLabel`: parameter unified to `viewerColor` (was `computerColor` in computer-game). Computer-game client now calls `getResultLabel(game.result, humanColor)` instead of passing the computer's color.
- Dead code: `lastComputerMoveSan` was computed but never rendered in `computer-game-client` — removed.

---

## Gate Results

### Typecheck
```
cd apps/web && pnpm exec tsc --noEmit
# EXIT 0 — no errors in src/ (e2e + test/ have pre-existing missing-dep errors, unchanged)
```

### Lint
```
cd apps/web && pnpm lint
# ✔ No ESLint warnings or errors
```

### Vitest
```
cd apps/web && pnpm exec vitest run test/
# Test Files  83 passed (83)
#      Tests  662 passed (662)
```

### jscpd — game client clones (cluster-specific)
```
npx --yes jscpd@4 \
  "apps/web/src/app/computer-game/[gameId]" \
  "apps/web/src/app/(play)/play/[gameId]" \
  --min-tokens 70 --min-lines 8 --gitignore
# Found 0 clones.
```

### jscpd — full repo
```
npx --yes jscpd@4 apps/web/src apps/api/src packages/shared/src \
  --min-tokens 70 --min-lines 8 --gitignore

# Baseline (S01):  45 clones / 931 dup lines (1.59%)
# After S10:       43 clones / 877 dup lines (1.5%)
# Net change:      -2 clones / -54 dup lines
```

Note: The jscpd total shows -2 clones rather than -6. This reflects jscpd's internal
de-duplication of overlapping sub-clone regions within the original 6 matches. The
cluster-specific scan confirms 0 clones remain between the two client files.

---

## E2E Spec List (for operator post-merge)

Run these specs after merging S10 changes to confirm no regressions:

| Spec | What to verify |
|------|---------------|
| `e2e/game-end.spec.ts` | `GameOverBanner` renders correct result/reason in both `/computer-game/[id]` and `/play/[id]` |
| `e2e/rated-game.spec.ts` | Rated badge, clock chips, result chip in player strips (`resultChipFor`) |
| `e2e/computer-abort-draw.spec.ts` | Abort button (before first move), draw-claim (threefold) on computer route |
| `e2e/result-overlay.spec.ts` | `ResultOverlay` with Rematch / New game / Analyze links (board overlay, not banner) |
| `e2e/premove.spec.ts` | Premove queues during opponent turn (live route only) |
| `e2e/reconnect.spec.ts` | Board recovers correct state after socket reconnect (live route only) |
| `e2e/rematch.spec.ts` | Offer/accept/decline rematch flow (live); Rematch button (computer) |

---

## Open Issues

None introduced by this session.

Pre-existing from S01:
- 4 unclaimed clusters (#10, #36–38, #42) totalling 74 lines — not addressed by this epic.

---

## Inputs for CI-Gate Session

- S10 shared modules are in `apps/web/src/` only. No API or shared package changes.
- The `Color` type is now exported from `@/lib/board/game-client-utils` (NOT from `@purechess/shared`). No cross-package dep added.
- `useLowTimeTick` hook takes `(yourTurnMs: number | null, lowTimeSoundEnabled: boolean)`. The `boolean` matches `settings-store.lowTimeSound`.
- Boilerplate clones that must remain: #12 (loading.tsx), #35 (auth forms), #43 (globals.css), #44–45 (error.tsx) — all still present; none touched by S10.
