# Session 01 Handoff — Charter + jscpd Baseline

**Branch:** `epic/dedup-cleanup--s01-charter`
**Date:** 2026-06-13
**Role:** Read-only audit. Zero source/test edits.

---

## jscpd Baseline

Command:
```
npx --yes jscpd@4 apps/web/src apps/api/src packages/shared/src \
  --min-tokens 70 --min-lines 8 --reporters json,console \
  --output /tmp/jscpd-base --gitignore
```

| Format     | Files | Total lines | Total tokens | Clones | Dup lines       | Dup tokens        |
|------------|-------|-------------|--------------|--------|-----------------|-------------------|
| typescript | 244   | 23021       | 200744       | 18     | 278 (1.21%)     | 2946 (1.47%)      |
| javascript | 157   | 11988       | 96367        | 5      | 206 (1.72%)     | 1689 (1.75%)      |
| tsx        | 180   | 22946       | 190496       | 21     | 415 (1.81%)     | 3325 (1.75%)      |
| css        | 2     | 580         | 3902         | 1      | 32  (5.52%)     | 317  (8.12%)      |
| **TOTAL**  | 583   | 58535       | 491509       | **45** | **931 (1.59%)** | **8277 (1.68%)**  |

JSON report saved to `/tmp/jscpd-base/jscpd-report.json`.

---

## Typecheck Gate

```
pnpm typecheck
```

- `apps/web tsc --noEmit` → **EXIT 0** (green after `pnpm install` + Prisma generate)
- `apps/api tsc --noEmit` → **EXIT 0** (green after `pnpm --filter @purechess/api db:generate`)
- Full `pnpm typecheck` → **EXIT 0**

No pre-existing errors. Fan-out sessions may proceed.

---

## All 45 Clones — Annotated

Format: `id | lines | file1:start-end ↔ file2:start-end | session | reason`

### Assigned to Sessions 02–10

| # | lines | Range 1 | Range 2 | Session |
|---|-------|---------|---------|---------|
| 18 | 18 | `apps/web/src/lib/board/sound.ts:116-133` | `sound.ts:63-80` | S02 |
| 19 | 16 | `apps/web/src/lib/board/sound.ts:237-252` | `sound.ts:221-236` | S02 |
| 20 | 12 | `apps/web/src/lib/board/sound.ts:253-264` | `sound.ts:221-232` | S02 |
| 26 | 58 | `apps/web/src/components/profile/rating-chart.tsx:165-222` | `components/puzzle/puzzle-rating-chart.tsx:105-163` | S03 |
| 27 | 36 | `apps/web/src/components/profile/rating-chart.tsx:222-257` | `components/puzzle/puzzle-rating-chart.tsx:161-199` | S03 |
| 28 | 13 | `apps/web/src/components/profile/rating-chart.tsx:29-41` | `components/puzzle/puzzle-rating-chart.tsx:21-33` | S03 |
| 33 | 27 | `apps/web/src/components/admin/users-table.tsx:173-199` | `app/admin/audit/page.tsx:116-142` | S04 |
| 34 | 27 | `apps/web/src/components/admin/games-table.tsx:152-178` | `components/admin/reports-table.tsx:186-212` | S04 |
| 24 | 35 | `apps/web/src/components/puzzle/training-session.tsx:262-296` | `app/puzzles/review/review-client.tsx:238-281` | S05 |
| 25 | 21 | `apps/web/src/components/puzzle/training-session.tsx:313-333` | `app/puzzles/review/review-client.tsx:288-308` | S05 |
| 40 | 19 | `apps/web/src/hooks/use-local-puzzle.ts:172-190` | `hooks/use-puzzle.ts:173-191` | S06 |
| 41 | 21 | `apps/web/src/hooks/use-local-puzzle.ts:213-233` | `hooks/use-puzzle.ts:206-226` | S06 |
| 29 | 23 | `apps/web/src/components/play/invite-create.tsx:168-190` | `play/quick-match-setup.tsx:123-145` | S07 |
| 30 | 36 | `apps/web/src/components/play/invite-create.tsx:206-241` | `play/quick-match-setup.tsx:138-173` | S07 |
| 31 | 16 | `apps/web/src/components/play/computer-game-setup.tsx:146-161` | `play/practice-from-fen-dialog.tsx:165-180` | S07 |
| 32 | 24 | `apps/web/src/components/play/computer-game-setup.tsx:242-265` | `play/invite-create.tsx:188-211` | S07 |
| 4  | 18 | `apps/api/src/puzzles/puzzle-review.service.ts:201-218` | `repertoire/repertoire-review.service.ts:303-320` | S08 |
| 21 | 15 | `apps/web/src/lib/board/pgn-parser.ts:98-112` | `apps/api/src/repertoire/repertoire-tree.ts:223-237` | S09 |
| 22 | 15 | `apps/web/src/lib/board/pgn-parser.ts:140-154` | `apps/api/src/repertoire/repertoire-tree.ts:249-263` | S09 |
| 23 | 19 | `apps/web/src/lib/board/pgn-parser.ts:201-219` | `apps/api/src/repertoire/repertoire-tree.ts:324-339` | S09 |
| 11 | 11 | `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx:452-462` | `live-game-client.tsx:293-303` *(intra-file)* | S10 |
| 13 | 67 | `apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx:615-681` | `live-game-client.tsx:626-742` | S10 |
| 14 | 42 | `computer-game-client.tsx:134-175` | `live-game-client.tsx:164-205` | S10 |
| 15 | 16 | `computer-game-client.tsx:184-199` | `live-game-client.tsx:223-238` | S10 |
| 16 | 15 | `computer-game-client.tsx:411-425` | `live-game-client.tsx:479-493` | S10 |
| 17 | 34 | `computer-game-client.tsx:698-731` | `live-game-client.tsx:753-786` | S10 |

**Assigned clones: 26 | Assigned dup lines: 657**

### Skipped / Unclaimed (22 clones)

| # | lines | Files | Skip reason |
|---|-------|-------|-------------|
| 1  | 15 | `result-detector.ts` ↔ `ts-adapter.ts` | Within chess/engine service, no session |
| 2  | 16 | `users.service.ts` ↔ `users.service.ts` | Intra-file self-clone |
| 3  | 18 | `puzzle-rush.service.ts` ↔ `puzzle-serving.service.ts` | Within-puzzles-module, unclaimed |
| 5  | 9  | `games.service.ts` ↔ `games.service.ts` | Intra-file self-clone |
| 6  | 23 | `computer-games.service.ts` ↔ `computer-games.service.ts` | Intra-file self-clone |
| 7  | 9  | `computer-game-actions.service.ts` ↔ `computer-games.service.ts` | Within-module |
| 8  | 12 | `computer-game-actions.service.ts` ↔ `computer-games.service.ts` | Within-module |
| 9  | 28 | `engine.service.ts` ↔ `chess/engine/game-state.ts` | Within chess module |
| 10 | 14 | `admin/reports/[id]/page.tsx` ↔ `admin/users/[id]/page.tsx` | Not in any session anchor — gap |
| 12 | 16 | `loading.tsx` ↔ `loading.tsx` | Next.js skeleton boilerplate (operator rule) |
| 35 | 20 | `login-form.tsx` ↔ `register-form.tsx` | Auth form boilerplate (operator rule) |
| 36 | 15 | `analyze-board.tsx` ↔ `games/[gameId]/review-client.tsx` | Unassigned analyze-board cluster |
| 37 | 12 | `analyze-board.tsx` ↔ `repertoire-explorer-builder.tsx` | Unassigned |
| 38 | 20 | `analyze-board.tsx` ↔ `games/[gameId]/review-client.tsx` | Unassigned |
| 39 | 14 | `admin/layout.tsx` ↔ `games/[gameId]/page.tsx` | Metadata auth pattern |
| 42 | 13 | `use-invite.ts` ↔ `lib/api/admin.ts` | Small fetch pattern, unclaimed |
| 43 | 33 | `globals.css:72-104` ↔ `globals.css:40-72` | Light/dark CSS blocks (operator rule) |
| 44 | 15 | `app/error.tsx` ↔ `app/games/error.tsx` | Next.js error.tsx boilerplate (operator rule) |
| 45 | 20 | `app/error.tsx` ↔ `app/global-error.tsx` | Next.js global-error.tsx boilerplate (operator rule) |

**Gaps (not in scope, not boilerplate, should be tracked):**
- Clone #10: `admin/reports/[id]/page.tsx:216-229` ↔ `admin/users/[id]/page.tsx:133-146` (14 lines)
- Clones #36-38: analyze-board ↔ review-client / repertoire-explorer-builder (47 lines)
- Clone #42: `use-invite.ts` ↔ `lib/api/admin.ts` (13 lines)

These 4 unclaimed clusters (74 lines) remain in the baseline. A follow-up epic may address them.

---

## Per-Cluster Fragment Confirmation

All anchor files verified present at expected paths. Line ranges confirmed against jscpd JSON output.

### S02 — sound.ts intra-file (3 clones, 46 lines)
- **Files:** `apps/web/src/lib/board/sound.ts` only
- **Fragments:** Duplicated `move` ↔ `castle` SoundDef blocks (18 lines), and two overlapping capture/castle voice-config segments (16 + 12 lines)
- **Shared home:** No new file. Extract private helper `makePieceLayerDef(baseFreq, opts)` within `sound.ts`
- **Status:** CONFIRMED present, disjoint ✓

### S03 — rating-chart (3 clones, 107 lines)
- **Files:** `apps/web/src/components/profile/rating-chart.tsx`, `apps/web/src/components/puzzle/puzzle-rating-chart.tsx`
- **Fragments:** SVG grid/axis helpers (13 lines), polyline+tooltip render (58 + 36 lines)
- **Shared home:** `apps/web/src/components/common/base-rating-chart.tsx` (new) — pure SVG core; both consumers render it with a `points` array
- **Status:** CONFIRMED present, disjoint ✓

### S04 — admin tables (2 clones, 54 lines)
- **Files:** `apps/web/src/components/admin/users-table.tsx`, `apps/web/src/components/admin/games-table.tsx`, `apps/web/src/components/admin/reports-table.tsx`, `apps/web/src/app/admin/audit/page.tsx`
- **Fragments:** Pagination row pattern (27 + 27 lines)
- **Shared home:** `apps/web/src/components/admin/table-pagination.tsx` (new) — shared paginator row
- **Note:** Clone #10 (`admin/reports/[id]` ↔ `admin/users/[id]`, 14 lines) is NOT in S04's scope
- **Status:** CONFIRMED present, disjoint ✓

### S05 — training-session ↔ review-client (2 clones, 56 lines)
- **Files:** `apps/web/src/components/puzzle/training-session.tsx`, `apps/web/src/app/puzzles/review/review-client.tsx`
- **Fragments:** Progress-bar + result-display JSX blocks (35 + 21 lines)
- **Shared home:** `apps/web/src/components/puzzle/puzzle-solve-shell.tsx` (new) or shared sub-component; exact shape determined by S05 author
- **Status:** CONFIRMED present, disjoint ✓

### S06 — use-local-puzzle ↔ use-puzzle (2 clones, 40 lines)
- **Files:** `apps/web/src/hooks/use-local-puzzle.ts`, `apps/web/src/hooks/use-puzzle.ts`
- **Fragments:** Move-feedback logic (19 + 21 lines)
- **Shared home:** `apps/web/src/lib/board/puzzle-utils.ts` (exists, expand) — already holds `uciToIntent`, `applyUci`, `solvingColorFromFen`, `uciMatch`, `normalizeCastleUci`
- **Status:** CONFIRMED present, disjoint ✓

### S07 — play dialog components (4 clones, 99 lines)
- **Files:** `apps/web/src/components/play/invite-create.tsx`, `quick-match-setup.tsx`, `computer-game-setup.tsx`, `practice-from-fen-dialog.tsx`
- **Fragments:** Time-control pill grid + side-selector (23 + 36 lines), submit-button + error-display rows (16 + 24 lines)
- **Shared home:** `apps/web/src/components/play/time-control-picker.tsx` (new)
- **Status:** CONFIRMED present, disjoint ✓

### S08 — puzzle-review ↔ repertoire-review SM-2 (1 clone, 18 lines)
- **Files:** `apps/api/src/puzzles/puzzle-review.service.ts`, `apps/api/src/repertoire/repertoire-review.service.ts`
- **Fragment:** `toCardState()` private function (18 lines, identical)
- **Shared home:** `apps/api/src/puzzles/spaced-repetition.ts` (exists) — already exports `schedule()` + `DEFAULT_EASE`; add `export function toCardState()` there
- **Status:** CONFIRMED present, disjoint ✓

### S09 — pgn-parser ↔ repertoire-tree (3 clones, 49 lines)
- **Files:** `apps/web/src/lib/board/pgn-parser.ts`, `apps/api/src/repertoire/repertoire-tree.ts`
- **Fragments:** PGN tokenizer sub-routines (15 + 15 + 19 lines) — pure TS, zero deps
- **Shared home:** `packages/shared/src/pgn-utils.ts` (new) — cross-package extraction
- **ESM note:** Use explicit `.js` extensions in shared relative imports; API Jest `moduleNameMapper` resolves `@purechess/shared/pgn-utils` → `src/pgn-utils.ts`
- **Status:** CONFIRMED present, disjoint ✓

### S10 — computer-game-client ↔ live-game-client (6 clones, 185 lines)
- **Files:** `apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx`, `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx`
- **Fragments:** Board interaction logic — move submission, sound dispatch, last-move state, clock derivation (11 + 67 + 42 + 16 + 15 + 34 lines). Clone #11 is intra-file within `live-game-client.tsx`
- **Shared home:** `apps/web/src/hooks/use-game-board.ts` (new) — shared hook; S10 must run Playwright E2E for both routes
- **Status:** CONFIRMED present, disjoint ✓

---

## Session Ownership Map

| Session | Files Owned (full paths) |
|---------|--------------------------|
| S02 | `apps/web/src/lib/board/sound.ts` |
| S03 | `apps/web/src/components/profile/rating-chart.tsx`, `apps/web/src/components/puzzle/puzzle-rating-chart.tsx` |
| S04 | `apps/web/src/components/admin/users-table.tsx`, `apps/web/src/components/admin/games-table.tsx`, `apps/web/src/components/admin/reports-table.tsx`, `apps/web/src/app/admin/audit/page.tsx` |
| S05 | `apps/web/src/components/puzzle/training-session.tsx`, `apps/web/src/app/puzzles/review/review-client.tsx` |
| S06 | `apps/web/src/hooks/use-local-puzzle.ts`, `apps/web/src/hooks/use-puzzle.ts` |
| S07 | `apps/web/src/components/play/invite-create.tsx`, `apps/web/src/components/play/quick-match-setup.tsx`, `apps/web/src/components/play/computer-game-setup.tsx`, `apps/web/src/components/play/practice-from-fen-dialog.tsx` |
| S08 | `apps/api/src/puzzles/puzzle-review.service.ts`, `apps/api/src/repertoire/repertoire-review.service.ts` |
| S09 | `apps/web/src/lib/board/pgn-parser.ts`, `apps/api/src/repertoire/repertoire-tree.ts` |
| S10 | `apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx`, `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx` |

**Intersection check: CONFIRMED DISJOINT.** No file appears in more than one session row.

New shared modules (also disjoint by path):

| Session | New/Expanded Module |
|---------|---------------------|
| S02 | No new file (intra-file refactor only) |
| S03 | `apps/web/src/components/common/base-rating-chart.tsx` (new) |
| S04 | `apps/web/src/components/admin/table-pagination.tsx` (new) |
| S05 | `apps/web/src/components/puzzle/puzzle-solve-shell.tsx` (new, shape TBD by S05) |
| S06 | `apps/web/src/lib/board/puzzle-utils.ts` (exists, expand) |
| S07 | `apps/web/src/components/play/time-control-picker.tsx` (new) |
| S08 | `apps/api/src/puzzles/spaced-repetition.ts` (exists, add export) |
| S09 | `packages/shared/src/pgn-utils.ts` (new) |
| S10 | `apps/web/src/hooks/use-game-board.ts` (new) |

---

## Produces-Overrides Assessment

All 9 anchor clusters confirmed present at declared paths with expected line ranges.
No cluster is already fixed or moved.

**Result: `docs/claude-sessions/dedup-cleanup/.epic-produces-overrides.json` NOT created.**
No overrides needed.

---

## Risks for Fan-out Sessions

| Risk | Affected | Mitigation |
|------|----------|------------|
| S09 adds `packages/shared` build dep; API Jest breaks if import path wrong | S09 | Use `moduleNameMapper` key `@purechess/shared/pgn-utils` → `<rootDir>/../../packages/shared/src/pgn-utils.ts` matching existing mapper pattern |
| S10 has 6 clone pairs (185 lines) spanning complex state | S10 | Run full Playwright E2E for both `/computer-game/[gameId]` and `/play/[gameId]` routes, not just unit tests |
| S08 `toCardState` is currently private; exporting it changes module surface | S08 | No callers outside the two services exist; marking it `export` is additive and safe |
| Unclaimed clusters (#3, #10, #36-38, #42) remain in jscpd total | All | Use per-cluster file-pair assertions for session DoD, not total-count assertions |
| `pnpm install` not run in fresh worktree | All | Each session must run `pnpm install` then `pnpm --filter @purechess/api db:generate` before typecheck |

---

## Open Issues

1. **4 unclaimed clusters (74 lines)** not addressed by any session: clone #10 (admin detail pages), clones #36-38 (analyze-board), clone #42 (use-invite ↔ admin.ts). Not boilerplate — genuine dedup opportunities for a follow-up epic.
2. **S05 shared-home shape is TBD.** The duplicated regions span JSX render blocks; the S05 author must decide between a shared sub-component (simpler) vs. a custom hook (more composable). Either approach must preserve identical rendered output.
3. **S09 cross-package extraction requires `packages/shared` rebuild** before api typecheck passes. The CI must build `packages/shared` before running api typecheck — already enforced by `pnpm build` order; confirm in worktree.

---

## Inputs for CI-Gate Session

- Baseline: **45 clones / 931 dup lines (1.59%)** at commit `epic/dedup-cleanup--s01-charter`
- Expected post-epic total: ≤19 clones / ≤274 dup lines (skipped/boilerplate remain)
- Typecheck gate: `pnpm typecheck` must exit 0 after `pnpm install` + `pnpm --filter @purechess/api db:generate`
- Per-cluster assertion: run jscpd and verify each session's assigned file pair(s) no longer appear in the clone list
- Boilerplate clones that must remain: #12 (loading.tsx), #35 (auth forms), #43 (globals.css), #44-45 (error.tsx) — do NOT flag these as failures
