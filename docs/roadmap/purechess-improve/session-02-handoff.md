# Session 02 handoff — Puzzle ingestion pipeline

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits.

## What was built

1. **Seed script** `apps/api/scripts/seed-puzzles.ts` — streams the lichess CC0
   puzzle dump and ingests the top-N by popularity into the `Puzzle` table.
   - Streams the CSV with `createReadStream + readline` (`for await … of rl`) —
     never loads the multi-GB dump into memory.
   - Top-N selection via a **bounded min-heap of size N** (`PopularityHeap`):
     root = current weakest kept row, single-compare admission ⇒ **O(count)**
     memory, not O(rows). Ties on popularity broken by `plays` (deterministic).
   - Parses rows: `moves`/`themes`/`openingTags` split on space + filter empties,
     ints coerced (garbage/empty → 0), rows with empty `PuzzleId`/`FEN`/`Moves`
     skipped, short/blank lines skipped.
   - Inserts in batches of 1000 via `createMany({ skipDuplicates: true })` —
     **idempotent** (PK = lichess `PuzzleId`). Logs progress.
   - Exits non-zero with a runbook-pointing message on file-not-found or a
     malformed header.
   - Pure helpers `parseRow` / `validateHeader` / `PopularityHeap` / `parseArgs`
     are exported with **no DB dependency** (unit-tested directly).
2. **`db:seed-puzzles` npm script** in `apps/api/package.json`:
   `ts-node --project tsconfig.seed.json scripts/seed-puzzles.ts`. Added
   `scripts/**/*` to `tsconfig.seed.json` include (was prisma+src only).
3. **`.gitignore`** (repo root) — `lichess_db_puzzle.csv` and `*.puzzle.csv`.
4. **`PuzzleCatalogService`** (`apps/api/src/puzzles/puzzle-catalog.service.ts`),
   registered + exported in `puzzles.module.ts` (additive; daily `PuzzlesService`
   untouched). Read-only lookups over the seeded bank for Train empty-state/UX.
5. **Tests** (`apps/api/test/puzzles/`): `seed-puzzles.spec.ts` (pure
   parse/select logic) + `puzzle-catalog.service.spec.ts` (mocked Prisma+Redis,
   caching assertion). 28 puzzle tests; 381 total api tests green.
6. **Runbook** `docs/runbooks/puzzle-db-refresh.md` + `apps/api/scripts/README.md`
   pointing to it.
7. **OpenWolf** cerebrum / anatomy / buglog (bug-514) / memory updated.

## 1. Quality gate — PASS

`cd apps/api && pnpm exec tsc --noEmit && pnpm test`

```
Test Suites: 34 passed, 34 total
Tests:       381 passed, 381 total
```

`tsc --noEmit` exited 0 (clean). `tsc --noEmit -p tsconfig.seed.json` (the seed
script + tests under the seed config) also exited 0.

## 2. How to seed locally + verification result

Command (from `apps/api`):

```sh
pnpm db:seed-puzzles ./lichess_db_puzzle.csv --count 50000 [--min-popularity 80]
```

Verification (synthetic 1000-row CSV with 3 intentionally-malformed rows, NOT
committed):

```sh
pnpm db:seed-puzzles /tmp/sample.csv --count 500
# → Selected 500 puzzles (top 500 by popularity).
# → Done. 500 new rows inserted (0 already present).
```

- **Rows landed:** `puzzle.count = 500`.
- **Malformed rows skipped:** the 3 bad rows (empty FEN / empty Moves / empty id)
  were dropped — 1000 valid → top 500 kept.
- **Top-N by popularity confirmed:** kept popularity range = **49..99** (the
  low-popularity tail was correctly dropped; max was 99).
- **Idempotency confirmed:** re-running the exact command →
  `Done. 0 new rows inserted (500 already present).`
- **Themed query returns:** `findMany({ where: { themes: { has: 'fork' }, rating:
  { gte: 1000, lte: 2500 } }, orderBy: { popularity: 'desc' }, take: 5 })` →
  5 rows, top popularity 99/96/96.
- The seeded sample rows were deleted afterward, so the live DB is back to
  `count = 0`. The sample CSV was removed and never committed (`.gitignore`
  covers it; `git status` shows no CSV).

## 3. PuzzleCatalogService method signatures

`apps/api/src/puzzles/puzzle-catalog.service.ts` — provided + exported by
`PuzzlesModule`. DI: `PrismaService`, `@Inject('REDIS_CLIENT') Redis`.

```ts
interface PuzzleThemeCount { theme: string; count: number }
interface PuzzleRatingRange { min: number; max: number }

class PuzzleCatalogService {
  // distinct themes with counts, most-common first; raw `unnest(themes)` GROUP BY,
  // count(*) bigint coerced to number; Redis-cached 1h (key `puzzle:catalog:themes`).
  listThemes(): Promise<PuzzleThemeCount[]>;

  count(): Promise<number>;                    // prisma.puzzle.count()

  // prisma aggregate _min/_max; returns { min: 0, max: 0 } on an empty bank.
  ratingRange(): Promise<PuzzleRatingRange>;
}
```

## 4. Indexes confirmed (EXPLAIN, run against the seeded sample)

`Puzzle` indexes present (from `pg_indexes`):
`Puzzle_pkey` (btree id), `Puzzle_rating_idx` (btree rating),
`Puzzle_themes_idx` (**gin** themes).

Hot selection query — uses the rating B-tree, **no seq-scan**:

```
EXPLAIN SELECT * FROM "Puzzle"
WHERE 'fork' = ANY(themes) AND rating BETWEEN 1000 AND 2500
ORDER BY popularity DESC LIMIT 20;

Limit
  ->  Sort  (Sort Key: popularity DESC)
        ->  Bitmap Heap Scan on "Puzzle"
              Recheck Cond: ((rating >= 1000) AND (rating <= 2500))
              Filter: ('fork'::text = ANY (themes))
              ->  Bitmap Index Scan on "Puzzle_rating_idx"
                    Index Cond: ((rating >= 1000) AND (rating <= 2500))
```

GIN index is usable for array-contains (proven by steering the planner with
`SET enable_seqscan = off`):

```
EXPLAIN SELECT * FROM "Puzzle" WHERE themes @> ARRAY['fork'] LIMIT 20;

Limit
  ->  Bitmap Heap Scan on "Puzzle"
        Recheck Cond: (themes @> '{fork}'::text[])
        ->  Bitmap Index Scan on "Puzzle_themes_idx"
              Index Cond: (themes @> '{fork}'::text[])
```

**Note for S03/S04 (per S01 DoD):** at 500 sample rows the planner prefers the
rating B-tree; the GIN becomes the natural choice only when a theme filter is
more selective than the rating band — likely only at the full 50k+ seed.
**Re-run EXPLAIN after the production 50k seed** to confirm no seq-scan at scale
and p95 < 80 ms.

## 5. Script invocation convention chosen — `ts-node`

`ts-node --project tsconfig.seed.json`, **not** `tsx`. Reason: the repo has no
`tsx` dependency; the existing Prisma seed runs `ts-node --project
tsconfig.seed.json prisma/seed.ts` (see `package.json` `prisma.seed`). Matching
that convention keeps a single TS runner for all DB scripts and reuses the
existing `tsconfig.seed.json` (`rootDir: "."`, `noEmit`). I extended that config's
`include` with `scripts/**/*` so the script type-checks under it (bug-514).

## 6. Deviations + commit

**Deviations from the spec:** none material. Notes:
- Spec text showed `tsx scripts/seed-puzzles.ts` as one option but said "or
  ts-node per repo convention — check how other api scripts run." Repo convention
  is `ts-node` → used that. (Recorded in cerebrum + this handoff.)
- Added `--count=N` / `--min-popularity=P` `=`-form parsing alongside the
  space-separated form for ergonomics (purely additive).
- `PuzzleCatalogService` is `exports`-ed from the module (not just provided) so
  later Wave-3 controllers can inject it.

**Inputs for dependent sessions:**
- Seed the bank with `pnpm db:seed-puzzles <csv> --count 50000` before any
  selection-query work; the live DB is currently empty (sample cleaned up).
- Inject `PuzzleCatalogService` for theme/count/range lookups (signatures above).
- Selection queries should filter on `rating` (B-tree) and/or `themes`
  (`{ has }` / `@> ARRAY[...]` → GIN); re-run EXPLAIN after the 50k seed.

**Commit:** `e231331` on `epic/purechess-improve`.
