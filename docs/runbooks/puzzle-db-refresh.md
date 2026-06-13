# Runbook: Puzzle DB refresh

How to (re)seed the `Puzzle` bank from the lichess open puzzle dump. The dump is
**never committed** — an operator downloads it, seeds it, and discards it.

## What this gives us

Our own copy of the top-N most-popular lichess puzzles in Postgres, so every
later selection query (theme filter, rating band, "due" queue) runs against our
indexes (`Puzzle_rating_idx` B-tree, `Puzzle_themes_idx` GIN) and never depends
on the lichess API at request time.

## 1. Download the dump

- Source: <https://database.lichess.org/#puzzles>
- File: `lichess_db_puzzle.csv.zst` (zstd-compressed; ~4M rows, multi-GB
  decompressed).
- **License: CC0 1.0 (public domain).** No attribution required, free to
  redistribute. (We still link lichess as a courtesy in the UI.)

Decompress to a plain CSV:

```sh
# macOS: brew install zstd ; Debian/Ubuntu: apt-get install zstd
zstd -d lichess_db_puzzle.csv.zst -o lichess_db_puzzle.csv
```

The CSV header MUST be exactly:

```
PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
```

The seed script aborts (exit 1) with a clear message if the header differs or
the file is missing.

> `lichess_db_puzzle.csv` and `*.puzzle.csv` are git-ignored. Do not commit the
> dump.

## 2. Seed

From `apps/api`:

```sh
pnpm db:seed-puzzles ./lichess_db_puzzle.csv --count 50000 [--min-popularity 80]
```

- `--count N` — keep the top **N** rows by `Popularity` (default 50000).
- `--min-popularity P` — optional pre-filter: ignore rows below popularity `P`
  before selection (a cheap way to skip the long low-quality tail).

**Memory:** the file is streamed line-by-line; selection uses a bounded
**min-heap of size N**, so memory is O(N), not O(rows). A multi-GB dump seeds
without loading into RAM.

**Idempotent:** insertion is `createMany({ skipDuplicates: true })` keyed on the
lichess `PuzzleId` (our PK), in batches of 1000. Re-running inserts only rows
not already present — safe to run repeatedly.

Expected timing (local Postgres): scanning ~4M rows + inserting 50k rows takes a
few minutes, dominated by the stream scan; the inserts are a few seconds.

## 3. Verify

From `apps/api`, a quick check (uses the generated Prisma client):

```sh
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{
  console.log('count =', await p.puzzle.count());
  const agg = await p.puzzle.aggregate({_min:{rating:true},_max:{rating:true},_avg:{popularity:true}});
  console.log('rating', agg._min.rating, '..', agg._max.rating, '| avg popularity', agg._avg.popularity);
  const themed = await p.puzzle.findMany({where:{themes:{has:'fork'}},take:3});
  console.log('themed(fork) sample:', themed.map(t=>t.id).join(', '));
  await p.\$disconnect();
})()"
```

Expect: `count` ≈ your `--count`, a sensible rating spread (≈ 400–3000), and a
non-empty themed sample.

Index sanity (no seq-scan on the hot selection query):

```sh
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{
  const plan = await p.\$queryRawUnsafe(\`EXPLAIN SELECT * FROM \\\"Puzzle\\\" WHERE rating BETWEEN 1400 AND 1600 AND 'fork' = ANY(themes) ORDER BY popularity DESC LIMIT 20\`);
  for (const r of plan) console.log(r['QUERY PLAN']);
  await p.\$disconnect();
})()"
```

Expect a **Bitmap Index Scan** on `Puzzle_rating_idx` (and/or `Puzzle_themes_idx`
when the theme filter is more selective than the rating band) — never a
`Seq Scan on "Puzzle"`.

The catalog API (`PuzzleCatalogService`) exposes the histogram for UI/empty-state:
`listThemes()` (theme → count, cached in Redis 1h), `count()`, `ratingRange()`.

## 4. Refresh without downtime

The seed is **upsert-shaped** (`skipDuplicates` on the `PuzzleId` PK), so a fresh
dump is applied by simply re-running the seed against the live DB:

```sh
pnpm db:seed-puzzles ./lichess_db_puzzle.csv --count 50000
```

- New puzzles are inserted; existing rows are left untouched (no row is locked
  for an update, so live reads never block).
- Because `Puzzle.id` is the lichess `PuzzleId`, re-seeds are deterministic and
  collision-free — no duplicate rows, no churn.
- After a refresh the cached theme histogram is stale for up to 1h. To refresh
  it immediately, flush the cache key: `redis-cli DEL puzzle:catalog:themes`.

> Updating a puzzle's *rating/popularity* in place (not just inserting new ones)
> is intentionally out of scope: `skipDuplicates` never overwrites. If a future
> need arises to refresh existing rows, switch the seed to a per-row
> `upsert`/`ON CONFLICT DO UPDATE` — but that loses the bulk-insert speed, so
> only do it when the requirement is real.
