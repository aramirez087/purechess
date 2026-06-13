# Session 12 handoff — Insights & weakness engine

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits, no S01
amendment needed — the `Move.moveTimeMs` time-management signal and the
`GameMistake.cpLoss` per-move blunder marker are read as-designed.

## What was built

The "what should I work on?" surface — a READ-ONLY engine that mines the
existing training signals into a ranked, evidence-backed weakness list, each
item deep-linking to the drill that fixes it.

1. **`weakness-detectors.ts`** (`apps/api/src/insights/`) — five PURE detectors,
   each taking already-aggregated inputs and returning `WeaknessDto | null`, so
   they're independently testable. Plus `themeCommonness`, `humanize`, and the
   exported threshold constants.
2. **`InsightsService`** (`insights.service.ts`) — gathers the per-domain
   aggregates (reusing `PuzzleServingService.getStats`, `GameMistakeService`,
   `EndgamesService.list`, and a few read-only Prisma aggregates), runs all
   detectors, ranks by `severity × impact`, dedupes by domain, returns the top
   5, and caches per user in Redis (15-min TTL). Exports the pure
   `rankWeaknesses` + `score` for testing the ordering.
3. **`InsightsController`** — `GET /train/insights` (`SessionAuthGuard` +
   `@CurrentUser`) → `InsightDto`.
4. **`InsightsModule`** — imports `AuthModule`, `PuzzlesModule`,
   `EndgamesModule`, `RepertoireModule`; exports `InsightsService` (S13 hub
   embeds the top insight). Registered in `app.module.ts`.
5. **Shared DTO** — extended `WeaknessDto` in `training.dto.ts` with the detector
   fields (`kind`, `title`, `evidence`, `severity`, `actionHref`) — all OPTIONAL
   per S00 — plus the `WeaknessKind` union. Shared rebuilt.
6. **Web** — `lib/api/training.ts` (`fetchInsights`), `app/train/insights/page.tsx`
   (server: auth + insights fetch), `insights-client.tsx` (ranked card list,
   sign-in / empty-low-data states).
7. **Tests** — `apps/api/test/insights/weakness-detectors.spec.ts` (40 cases).

## 1. Quality gates — PASS/FAIL with actual final output

| Gate | Result | Final output line |
|---|---|---|
| `cd apps/api && pnpm exec tsc --noEmit` | **PASS** | `API_TSC_EXIT=0` (clean) |
| `cd apps/api && pnpm test` | **PASS** | `Test Suites: 45 passed, 45 total` / `Tests: 558 passed, 558 total` |
| `cd packages/shared && pnpm build` | **PASS** | `SHARED_BUILD_EXIT=0` (clean) |
| `cd apps/web && pnpm exec tsc --noEmit` | **PASS** | `WEB_TSC_EXIT=0` (clean) |
| `cd apps/web && pnpm exec vitest run test/` | **PASS** | `Test Files  79 passed (79)` / `Tests  621 passed (621)` |

API tests 518 (S11) → **558** (+40 new detector cases). Web tests unchanged at
**621** (the insights page is server-fetched; no new web spec was required — the
trust-critical tests are the pure API detectors). The S12 spec in isolation:
`weakness-detectors.spec.ts` → `Tests: 40 passed`.

## 2. `InsightDto` / `WeaknessDto` shape + actionHref conventions (S13 input)

`GET /train/insights` → `InsightDto`:

```ts
interface InsightDto {
  generatedAt?: string;           // ISO compute time
  headline?: string;              // = weaknesses[0]?.title (the top priority)
  weaknesses: WeaknessDto[];      // ranked strongest-first, ≤ 5, deduped by kind
}

type WeaknessKind = 'theme' | 'game-mistake' | 'opening' | 'endgame' | 'time';

interface WeaknessDto {
  area: 'theme' | 'opening' | 'endgame' | 'time'; // S01 back-compat (game-mistake → theme)
  kind?: WeaknessKind;            // finer-grained domain the detector set
  slug?: string;                  // theme/endgame-category slug (absent for opening/time)
  label: string;                  // human label
  title?: string;                 // plain-language card title
  evidence?: string;              // one line WITH the numbers
  severity?: number;              // 0..1, higher = weaker / more urgent
  actionHref?: string;            // deep link to the fixing drill
  accuracy?: number;              // 0..1 where applicable
  sampleSize?: number;            // the volume behind the signal
  estimatedEloUpside?: number;    // heuristic ELO on the table (the IMPACT term)
}
```

**For S13 (hub embeds the top insight):** inject `InsightsService` (exported
from `InsightsModule`) and call `getInsights(user.id)`; the headline card is
`insight.weaknesses[0]` (or `insight.headline` for the one-liner). The result is
already cached, so the hub read is cheap.

**`actionHref` conventions** (every card's "Fix this" button):

| kind | actionHref | drill it opens |
|---|---|---|
| `theme` | `/puzzles/train?theme=<slug>` | theme trainer pre-selected |
| `game-mistake` | `/puzzles/train?theme=<slug>` | theme trainer for the recurring motif |
| `opening` | `/openings?repertoire=<repertoireId>` | opening trainer for the leaky repertoire |
| `endgame` | `/endgames?category=<category>` | endgames list, that family |
| `time` | `/play` | play a game (slow down / manage the clock) |

The web client maps each `kind` to an icon + button verb (`KIND_META` in
`insights-client.tsx`); an unknown kind falls back to a neutral icon + "Fix this".

## 3. Detector firing thresholds (the trust-critical knobs)

All thresholds are exported constants from `weakness-detectors.ts`. Each
detector is CONSERVATIVE — a volume floor AND a clear-gap condition, never a
one-off miss.

| Detector | Fires when | Severity | Silent on |
|---|---|---|---|
| `tacticalThemeWeakness(themeStats)` | a theme has **≥ 15 attempts** (`THEME_MIN_ATTEMPTS`) AND **accuracy ≤ 0.65** (`THEME_WEAK_ACCURACY`). Among qualifiers, the largest `(1−acc) × commonness` wins (a weak common motif beats a slightly-weaker rare one). | gap below the weak band mapped onto 0..1, pinned near 1 at **≤ 0.40** (`THEME_SEVERE_ACCURACY`) | < 15 attempts, accuracy > 0.65, undefined accuracy, empty |
| `recurringGameMistake(clusters)` | a `themeGuess` cluster has **≥ 3** same-theme mistakes (`RECURRING_MISTAKE_MIN`) across the user's recent games. Largest cluster wins (commonness tie-break). | `count / 6`, capped at 1 (3 ⇒ ~0.5, 6+ ⇒ 1) | count < 3, empty |
| `openingLeak(outcomes)` | a repertoire line has **≥ 3 lapses** (`OPENING_LEAK_MIN_LAPSES`). Most-lapsed wins (lapse-rate tie-break). | `lapses / 6`, capped | lapses < 3, empty |
| `endgameGap(stats)` | a category has **≥ 2** attempted-but-never-solved drills (`ENDGAME_GAP_MIN_UNSOLVED`). Most-unsolved wins (miss-rate tie-break). | `unsolved / attempted` | unsolved < 2, empty |
| `timeManagement(agg)` | see §3.1 — the most conservative | see §3.1 | thin data (always) |

`estimatedEloUpside` (impact) is a per-detector heuristic — common motifs and
real-game blunders score higher (≈ 10–70 ELO), opening/endgame leaks lower
(≈ 8–40).

### 3.1 How `timeManagement` stays conservative

It fires on exactly one of two CLEAR signals, and `null` otherwise:

1. **Fast blunders.** Requires **≥ 20 fast moves** (`TIME_FAST_MOVE_MIN_SAMPLE`,
   a "fast" move is `< 3000ms` = `TIME_FAST_MOVE_MS`) AND a fast-move blunder
   rate **≥ 0.25** (`TIME_FAST_BLUNDER_RATE`) AND that rate **≥ 2× the user's
   overall blunder baseline**. The baseline comparison is the key guard: without
   it a uniformly-blundery player and a reckless-when-fast player look identical,
   so the detector would mislabel a general weakness as a time problem. It must
   prove fast moves are *specifically* worse.
2. **Flag losses.** Requires **≥ 10 decisive games** (`TIME_FLAG_MIN_GAMES`) AND
   a flag-loss rate **≥ 0.25** (`TIME_FLAG_LOSS_RATE`) AND **≥ 2** absolute flag
   losses (so one unlucky flag over a few games never fires).

Tests prove the silence: 100%-blunder tiny fast sample → null; fast rate equal
to baseline → null; fast rate below the 0.25 floor → null; 75% flag rate over 4
games → null; a single flag over 30 games → null; all-zero → null. A bogus
time-management nudge is the easiest way to lose trust, so "no signal beats a
wrong signal" is enforced here above all.

## 4. The ranking formula (severity × impact)

`InsightsService.compute` runs all detectors, then `rankWeaknesses(candidates)`:

1. **Drop nulls.**
2. **Dedupe by `kind`** — keep the strongest per domain (so the list never shows
   two theme cards). `game-mistake` and `theme` are DISTINCT kinds, so a recurring
   real-game motif and a puzzle-accuracy gap can both appear.
3. **Sort by `score = severity × impact`** descending, where
   `impact = estimatedEloUpside ?? 10`. Tie-break: higher raw severity, then
   label (deterministic).
4. **Cap at `MAX_INSIGHTS = 5`.**

`score()` and `rankWeaknesses()` are pure + exported from `insights.service.ts`
and unit-tested (ordering, null-drop, dedupe, the high-impact-low-severity beats
low-impact-high-severity case, impact default = 10).

## 5. Aggregate gathering — reuse, not rebuild

| Signal | Source (reused) |
|---|---|
| theme accuracy | `PuzzleServingService.getStats(userId)` (S03) |
| game-mistake clusters | `GameMistakeService.listMistakes(userId)` (S07) → cluster `themeGuess[]` |
| opening leaks | read-only `repertoireReview.findMany({ userId, lapses>0 })` + repertoire names |
| endgame gaps | `EndgamesService.list(userId)` (S10) → group `attempted && !solved` by category |
| time management | read-only `game`/`move`/`gameMistake` aggregate over the last 30 completed games |

**Time-management read is fully read-only and uses no live engine.** It reads
`Move.moveTimeMs` for speed and the already-persisted `GameMistake.cpLoss ≥ 150`
rows (keyed `gameId:ply`) as the per-move blunder marker — the FEN trail is NOT
re-evaluated. Flag losses come from `Game.result` + `resultReason === 'timeout'`.

## 6. Cache

Per-user Redis key `insights:<userId>`, value = JSON `InsightDto`, **TTL 900s
(15 min)** (`INSIGHTS_CACHE_TTL_SECONDS`). `getInsights(userId, force=false)`
serves warm, computes + writes on miss. Cache read/write failures are logged and
degrade to a fresh compute (never throw into the request path) — same defensive
pattern as `TablebaseService`.

## 7. Deviations + notes

- **`game-mistake` is a NEW `WeaknessKind` distinct from `theme`.** The
  `WeaknessDto.area` enum (S01) has no `game-mistake`, so `area` stays `'theme'`
  for back-compat and the finer `kind` carries the distinction. This lets a
  recurring real-game blunder and a puzzle-accuracy gap on the *same* motif both
  surface (they are different evidence and different urgency).
- **`themeGuess` is currently empty in practice** (S07 noted the client classifier
  doesn't populate it yet). `recurringGameMistake` is fully plumbed and tested;
  it simply produces no cluster until theme tags are populated (a backfill or a
  client motif-tagger — no schema change needed, the field is optional). The
  detector + its tests are correct for the day tags land.
- **No new web spec.** The trust-critical surface is the pure detectors (40
  cases). The page is a thin server-fetch + presentational client; adding a web
  render test would duplicate coverage without adding signal. (Web suite stays
  green at 621.)
- **Opening `actionHref` is `/openings?repertoire=<id>`**, not a per-line deep
  link — the line resolution (nodePath → position) lives in the opening trainer
  (S09 §3); pointing at the repertoire is the closest stable link the leak signal
  can produce without re-implementing the tree walk here.
- **No WS, no schema change, no engine-path import** — insights code is entirely
  outside `apps/api/src/chess/engine/`, so the coverage gate is untouched.
- **No new DB hot query against `Puzzle`.** The time-management aggregate reads
  the user's own recent games/moves/mistakes (all on `[userId, createdAt]` /
  `[gameId, ply]` indexes, capped at 30 games); the opening read is a bounded
  `findMany(take: 50)` on `RepertoireReview`. No seq-scan on the 50k `Puzzle`
  bank — the heavy roll-ups are delegated to the existing services. EXPLAIN not
  re-run (no new query shape touches `Puzzle`).

## Inputs for dependent sessions

- **S13 (training hub):** inject `InsightsService` (exported from
  `InsightsModule`), call `getInsights(user.id)`; embed `weaknesses[0]` as the
  "work on this" headline card. The result is cached (15 min). The full ranked
  list lives at `/train/insights`; link the hub card there for "see all".
- **Populate `GameMistake.themeGuess`** (a client motif-tagger or a server
  backfill) to light up the `recurring game mistake` card — the detector is
  ready and tested; the field is optional, no schema change.
- **Detector thresholds** are exported constants from `weakness-detectors.ts`
  (`THEME_MIN_ATTEMPTS`, `THEME_WEAK_ACCURACY`, `RECURRING_MISTAKE_MIN`,
  `OPENING_LEAK_MIN_LAPSES`, `ENDGAME_GAP_MIN_UNSOLVED`, the `TIME_*` set) — tune
  there, the tests pin the firing/silence behavior around them.

**Commit:** see the S12 commit on `epic/purechess-improve` (message
`feat(improve): S12 insights & weakness engine`).
