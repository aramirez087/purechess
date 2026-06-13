# Session 10 handoff — Endgame drills (vs tablebase)

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No new columns needed.

## What was built

1. **Curated EndgameDrill seed** — `apps/api/prisma/seed/endgame-drills.ts`. 25
   hand-picked drills across all six `EndgameCategory` families with CORRECT,
   LEGAL FENs. Exported pure catalog `ENDGAME_DRILLS` + `assertLegalFen` /
   `assertAllLegal` (chess.js: legal, NOT in check, NOT game over — verified at
   runtime BEFORE any DB write so a bad FEN aborts the run) + idempotent
   `seedEndgameDrills(prisma)` (upsert by `slug`, the frozen `@unique`). New
   script `pnpm db:seed-endgames` (`ts-node --project tsconfig.seed.json
   prisma/seed/endgame-drills.ts` — `prisma/**` is already in the seed tsconfig
   include). **Every FEN was tablebase-spot-checked**, not just legal: the
   Philidor and opposite-colour-bishop "draw" holds had to be re-picked because
   my first FENs probed as `win` (see Deviations / bug-545).
2. **`TablebaseService`** — `apps/api/src/endgames/tablebase.service.ts`. Proxies
   the lichess 7-man tablebase, caches every immutable result HARD in Redis (key
   `endgame:tb:<FEN>`, 30-day TTL). `>7` men short-circuits to `'unknown'`
   without an upstream call; a 4 s timeout / HTTP error / parse error all degrade
   to `'unknown'` and are NOT cached (so the next probe retries). Never throws
   into the request path. `normalize` / `countMen` / `mapCategory` are
   exported-pure.
3. **EndgamesModule + Service + Controller** — registered in
   `apps/api/src/app.module.ts`. Routes below. Server-authoritative: the client
   reports an outcome, the row is persisted here.
4. **Shared DTOs** — `packages/shared/src/dto/endgame.dto.ts`
   (`EndgameDrillDto`, `EndgameProbeDto`, `EndgameAttemptInputDto`,
   `EndgameAttemptResultDto`), exported from `index.ts`, shared rebuilt.
5. **`use-endgame-drill.ts`** — `apps/web/src/hooks/use-endgame-drill.ts`. Async
   drill state machine with instant throw-the-win detection (below).
6. **`endgames-client.tsx`** — `apps/web/src/app/endgames/endgames-client.tsx`
   replaces the S01 placeholder (the `page.tsx` server shell is kept). Categorized
   drill list with pass/fail ticks, a Practice board (the existing `<Chessboard>`
   + client Stockfish), and a "Show best move" reveal from the probe.
7. **Web API client** — `apps/web/src/lib/api/endgames.ts`.
8. **Tests** — `apps/api/test/endgames/endgames.service.spec.ts` (14) and
   `apps/web/test/endgames/use-endgame-drill.test.ts` (12).

## 1. Quality gates — PASS/FAIL with actual final output

| Gate | Result | Final output line |
|---|---|---|
| `cd apps/api && pnpm exec tsc --noEmit` | **PASS** | exit 0 (no output) |
| `cd apps/api && pnpm test` | **PASS** | `Test Suites: 43 passed, 43 total` / `Tests: 507 passed, 507 total` |
| `cd packages/shared && pnpm build` | **PASS** | exit 0; `dist/dto/endgame.dto.{js,d.ts}` present |
| `cd apps/web && pnpm exec tsc --noEmit` | **PASS** | exit 0 (no output) |
| `cd apps/web && pnpm exec vitest run test/` | **PASS** | `Test Files 78 passed (78)` / `Tests 613 passed (613)` |
| `cd apps/api && pnpm lint` (`eslint src`) | **PASS** | exit 0 |

**Seed verification:**
- `pnpm db:seed-endgames` → `Seeded 25 endgame drills (25 new, 0 updated).`
  (first run on a fresh table) then `(0 new, 25 updated)` on re-run.
- Final `EndgameDrill` row count = **25**, all 25 FENs legal / not-in-check /
  not-game-over (chess.js) and objective-verified against the lichess tablebase.
- **Idempotent:** re-run reports `0 new, 25 updated`; total stays 25.

## 2. Seeded slugs + categories (25)

| Category | Objective | Slugs |
|---|---|---|
| `basic_mate` (6) | win | `kq-vs-k-center`, `kq-vs-k-edge`, `kr-vs-k-center`, `kr-vs-k-cutoff`, `kr-vs-k-2nd-rank`, `kbb-vs-k` |
| `king_pawn` (7) | win | `kp-vs-k-in-front`, `kp-vs-k-outside`, `kp-vs-k-opposition`, `kp-vs-k-behind`, `two-connected-pawns`, `k-and-2-connected` |
| `king_pawn` | draw | `kp-vs-k-rook-pawn-draw` |
| `rook` (5) | win | `kr-vs-kp-stop`, `lucena`, `rp-vs-r-convert`, `rp-vs-r-3rd-rank` |
| `rook` | draw | `philidor` |
| `minor` (4) | win | `bishop-pawn-promote`, `kbn-vs-k-classic`, `kbn-vs-k-defender` |
| `minor` | draw | `ocb-draw-hold` |
| `queen` (2) | win | `q-vs-pawn-7th`, `kqp-vs-kq-convert` |
| `other` (1) | win | `q-vs-rook-win` |

Verified-draw FENs (the load-bearing ones):
- `philidor` = `8/8/4k3/8/4p3/r7/4K3/4R3 w - - 0 1` (white K+R defends K+R+P; tablebase = draw)
- `ocb-draw-hold` = `8/8/4k3/3bp3/4P3/4K3/4B3/8 w - - 0 1` (opposite bishops; tablebase = draw)
- `kp-vs-k-rook-pawn-draw` = `8/8/8/8/k7/P7/K7/8 b - - 0 1` (rook-pawn; tablebase = draw)

## 3. Probe contract + cache-key shape + throw-detection

**Probe contract.** `POST /api/endgames/:slug/probe` body `{ fen }` →
`EndgameProbeDto { category: 'win'|'draw'|'loss'|'unknown'; bestMove?: string; dtm?: number }`.
The service validates the slug exists first (404 otherwise — it is NOT an open
tablebase proxy), then delegates to `TablebaseService.probe(fen)`. `category` is
from the **side-to-move POV**. `'unknown'` = more than 7 men OR an upstream
failure → the client falls back to Stockfish.

**Cache key shape.** Redis string key `endgame:tb:<trimmed FEN>`, value =
JSON-serialized normalized probe, TTL **30 days** (positions are immutable, so
"cache hard"). A `'unknown'` from a transient failure is deliberately NOT cached.
`>7` men never hits the network or the cache.

**Throw-detection (the teaching moment).** After EACH user move the hook probes
the resulting position — it is now the DEFENDER to move, so the probe is
defender-POV. The pure rule is `isSlip(objective, defenderCategory)`:
- **win** drill: defender NOT `'loss'` ⇒ the user threw the win → fail
  immediately with `failReason: 'threw-win'`.
- **draw** drill: defender `'win'` ⇒ the user lost the draw → fail with
  `failReason: 'lost-draw'`.
- `'unknown'` is NEVER a slip on its own (a flip can't be proven without the
  tablebase) — the drill continues and Stockfish defends.

The flip is detected BEFORE the defender replies, so the feedback is instant.
Mate by the user (`positionStatus(fen).checkmate`) is success without a probe.

## 4. Endgame outcomes shape for S12 "endgame gaps"

The per-drill outcome signal is the `EndgameAttempt` row
(`{ drillId, succeeded, movesPlayed, createdAt }`). `EndgamesService.list()`
already aggregates it the way S12 should: one
`endgameAttempt.groupBy({ by: ['drillId'], _count: { _all }, _max: { succeeded } })`
yields, per drill, `attempted = _count._all > 0` and `solved = _max.succeeded`
(true iff ANY attempt passed). Each `EndgameDrillDto` carries
`category`, `objective`, `attempted?`, `solved?`.

**Recommended "gap" definition for S12:** a drill the user has `attempted` but
never `solved` (`attempted && !solved`). Group those by `EndgameDrill.category`;
the weakest family is the one with the most unpassed-but-attempted drills (same
weakest-first shape as the puzzle `getStats` signal). `EndgamesService` is
exported from `EndgamesModule`, so S12 injects it directly — no new query needed
beyond filtering the existing `list(userId)` output, or add a
`weakCategories(userId)` helper that reuses the same groupBy.

## 5. Deviations + git commit hash

- **Curated FENs were tablebase-validated, not just legality-validated.** My
  first Philidor and opposite-colour-bishop "draw" FENs probed as `win` (the
  side to move was materially better) — a curation bug, since a drill's stated
  objective must match ground truth. Re-picked both to verified draws. Logged as
  `bug-545`. The seed's `assertLegalFen` enforces legal + not-in-check +
  not-game-over at runtime; objective-vs-tablebase is enforced by the curation
  process (spot-checked via `curl`, not in code, since the seed must not depend
  on a live network call).
- **Seed lives in `prisma/seed/` (not `scripts/`)** per the declared `produces:`
  path. `tsconfig.seed.json` already includes `prisma/**`, so (unlike S02) no
  include edit was needed.
- **List/get use `OptionalSessionAuthGuard`**, not `SessionAuthGuard` — the
  catalog is public, and `@CurrentUser() user?: User` is `undefined` when
  signed out, which `list(undefined)` / `getBySlug(slug, undefined)` handle by
  skipping the per-user merge.
- **No WS, no schema change, no engine-path import** — endgame code is fully
  outside `apps/api/src/chess/engine/`, so the coverage gate is untouched.
- **Defender movetime/level** live in the client (`getBestMove(fen, 8, 2000)`),
  not the hook — the hook takes an injected `engineMoveFn` so it stays testable
  without the Stockfish worker.

**Commit:** `507e63c198af458293e4f91fb7fd9f92745bceb0` — `feat(improve): S10 endgame drills`.
(Earlier draft of this handoff referenced the pre-amend hash `01e69a0`.)

## Inputs for dependent sessions

- **S12 (endgame gaps):** inject `EndgamesService` (exported); use
  `list(userId)` → filter `attempted && !solved`, group by `category`.
- **S13 (hub):** `EndgamesService` + `TablebaseService` are exported from
  `EndgamesModule`. A per-user "drills passed / total" badge is
  `list(userId).filter(d => d.solved).length` over the 25-drill bank.
- **Probe endpoint** for any future surface: `POST /api/endgames/:slug/probe`
  `{ fen }` — server-side + cached, never expose the lichess URL to the client.
