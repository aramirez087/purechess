# Purechess "Category Best" — File-Ownership Charter (Sessions 02–06)

**Authored:** Session 01, 2026-06-10.
**Purpose:** Single-writer-per-file map so sessions 02–06 run in **parallel** without merge
conflicts. Each file has exactly one owning session; any file two sessions could plausibly
touch is flagged and assigned, with a workaround for the non-owner.

> ⚠️ **Important — this is a BEST-EFFORT charter, not a read of session frontmatter.**
> The downstream session files (`docs/claude-sessions/purechess-category-best/session-02..06.md`)
> **do not exist in this worktree** — the directory `docs/claude-sessions/` is absent entirely.
> Tasks 4 & 5 of session 01 assume those files exist with `touches`/`produces` frontmatter to
> read; they could not be read. This map is therefore **derived** from: (a) the hardening
> surfaces named in the OPERATOR RULES, (b) the anchors in this session's instructions, and
> (c) the ranked backlog in `docs/HANDOFF-next-level.md` (Tier A/B). **When the real session
> files appear, reconcile their `touches` globs against this map and update.** Section 5 lists
> the verification step.

---

## 1. Proposed session domains

No new features — each domain **hardens one existing surface**. Domains are chosen so their
file sets are disjoint (the goal of this charter).

| Session | Domain | Primary surface |
|---|---|---|
| **S02** | **Bundle & web performance** (LCP, First Load JS, code-splitting) | `apps/web` build/config, lazy-loading, shared-bundle slimming |
| **S03** | **Realtime reliability** (reconnect < 2 s, dead-peer detection, presence) | `use-game-socket.ts`, `realtime.gateway.ts`, realtime service |
| **S04** | **Engine correctness** (move validation, flag-fall, coverage gate) | `apps/api/src/chess/engine/**`, engine specs |
| **S05** | **Ratings & persistence integrity** (Glicko-2 tx, FOR UPDATE locks, ledger delta) | `apps/api/src/ratings/**`, games persistence |
| **S06** | **Accessibility & design polish** (a11y ≥ 95 hold, Silent Tournament voice) | `apps/web/src/components/**`, `globals.css`, design.md compliance |

---

## 2. File-ownership map (single writer per file)

### S02 — Bundle & web performance
- `apps/web/next.config.mjs`
- `apps/web/package.json` (deps for lazy-loading / analyzer)
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
- `apps/web/src/app/analyze/**`
- Dynamic-import wrappers around `chess.js` / Stockfish glue / Sentry / PostHog init
- `apps/web/instrumentation*.ts`, `sentry.*.config.ts` (lazy/treeshake)

### S03 — Realtime reliability
- `apps/web/src/hooks/use-game-socket.ts`
- `apps/api/src/realtime/realtime.gateway.ts`
- `apps/api/src/realtime/realtime.service.ts`
- `apps/api/test/realtime/**`

### S04 — Engine correctness
- `apps/api/src/chess/engine/**` (`move-validator`, `game-state`, `clock`,
  `result-detector`, `fen-utils`, `pgn-builder`)
- `apps/api/test/chess/**` engine specs
- **SACRED:** `apps/api/test/games/games.service.spec.ts` flag-fall specs (bug-005) — may be
  extended, never weakened. Owned by S04; S05 must not edit (see §3).

### S05 — Ratings & persistence integrity
- `apps/api/src/ratings/**` (`ratings.service.ts`, module, controller)
- `apps/api/src/games/games.service.ts` (persistence/transaction side only)
- `apps/api/test/ratings/**`
- `apps/web/src/app/games/**` (rating-delta ledger surfacing, web side)

### S06 — Accessibility & design polish
- `apps/web/src/components/**`
- `apps/web/src/app/globals.css` (new utilities go here, NOT tailwind.config — see §4)
- `apps/web/src/app/(play)/**` markup/ARIA (non-logic)
- Per-route a11y fixes outside the files owned by S02/S05

---

## 3. Overlap hazards & resolutions

These files are plausibly wanted by two sessions. Each is assigned **one owner**; the
non-owner uses the stated workaround.

| File / glob | Wanted by | **Owner** | Workaround for non-owner |
|---|---|---|---|
| `apps/api/src/games/games.service.ts` | S04 (engine wiring), S05 (persistence/tx) | **S05** | S04 changes engine **internals only**; if a `games.service` call-site must change, S04 specifies the exact diff in its handoff and S05 applies it. The bug-005 flag-fall persistence contract (no Move row on flag fall) is locked by both. |
| `apps/api/test/games/games.service.spec.ts` | S04, S05 | **S04** | Sacred bug-005 specs. S05 adds rating-assertion specs in a **separate** `*.spec.ts` (e.g. `ratings.integration.spec.ts`), never edits this file. |
| `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx` | S03 (socket merge), S06 (a11y/markup) | **S03** | The `isStaleState` guard + merge paths are S03's. S06 does a11y/markup-only edits **only if** S03 has finished; otherwise S06 files the change for S03. Every server-state merge must stay behind `isStaleState`. |
| `packages/shared/src/**` (DTOs, `ws-events.ts`) | S03 (WS payloads), S05 (rating-delta DTO field) | **shared = append-only, coordinated** | New DTO fields must be **optional** and added by **append** only; sessions add their field in distinct interfaces/lines to avoid line conflicts. Rebuild after edit: `pnpm --filter @purechess/shared build`. If both must touch `ws-events.ts`, S03 owns it and adds S05's event/field on request. |
| `apps/web/src/app/games/**` | S05 (delta ledger), S06 (a11y) | **S05** for the delta DTO wiring; **S06** for pure a11y/markup | Sequence: S05 lands the data, S06 polishes. If parallel, S06 limits to ARIA/contrast on untouched lines. |
| `apps/web/src/app/globals.css` | S02 (perf-related CSS), S06 (design utilities) | **S06** | S02 avoids CSS edits; any perf-CSS need is filed to S06. New utilities go in `@layer utilities` here (never `tailwind.config.ts`, which needs a dev restart). |
| `apps/web/package.json` | S02 (deps), S05/S06 (rare) | **S02** | Only S02 adds web deps. Others request additions via handoff. |

**Engine coverage gate** (`apps/api/src/chess/engine/`, 90% lines/functions, 85% branches)
is S04's responsibility to keep green; no other session edits engine files.

---

## 4. Cross-cutting constraints every session inherits

- **No new features.** No new routes/modes/settings/endpoints beyond what hardening requires.
- **design.md is law** (radius 14/10/7, one brass accent, AA floor `#8a958a`, `text-brass-text`).
- **WS event names** only from the `WsEvent` enum in `@purechess/shared` — never raw strings.
- **packages/shared**: plain TS, zero runtime deps, explicit `.js` relative imports, new DTO
  fields **optional**, rebuild after edits.
- **`tailwind.config.ts` edits need a dev-server restart** → prefer `globals.css @layer utilities`.
- **bug-005 flag-fall semantics are sacred** — `applyMove` returns a completed game without
  appending the move on flag fall; persistence never creates a Move row for it.
- **`isStaleState` guard** in `live-game-client.tsx` and **RatingsService FOR UPDATE tx** must
  not be regressed.

---

## 5. Reconciliation step (do this when session files appear)

This map is provisional. When `docs/claude-sessions/purechess-category-best/session-02..06.md`
exist:
1. Read each file's frontmatter `touches` globs.
2. Diff against §2 above. For every glob in their frontmatter, confirm it maps to exactly one
   owner here. Add any missing globs; flag any **new** overlap and assign a single owner +
   workaround (same pattern as §3).
3. If any session's `produces` is already satisfied by today's code, record an override in
   `docs/claude-sessions/purechess-category-best/.epic-produces-overrides.json` (see
   session-01 handoff §"Task 5 — overrides").
4. Confirm **zero unresolved overlaps** before the parallel wave starts.
