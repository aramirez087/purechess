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

## 5. Production refresh procedure + cadence

**Cadence: quarterly** (every ~3 months), or ad-hoc when the player base reports
the bank feels stale at a rating band. The lichess dump grows slowly; a quarterly
top-50k refresh keeps fresh, high-popularity tactics flowing without churn. The
bank is **immutable enough to not need a tighter cadence** — puzzle quality is
stable, and per-user difficulty is handled by the Glicko serving ladder, not by
swapping puzzles.

Production steps (run from an operator box with prod DB access, e.g. a Fly.io
machine `fly ssh console -a purechess-api`, or locally against the prod
`DATABASE_URL`):

1. **Back up first** (the seed is additive, but always snapshot before a bulk
   write): `bash scripts/db-backup.sh` (pg_dump custom format to `/tmp`).
2. **Download + decompress** the latest dump (steps 1 above). Do this on a box
   with the disk + bandwidth for a multi-GB file — *not* committed, *not* left on
   the machine after seeding.
3. **Seed** against the prod DB:
   `pnpm db:seed-puzzles ./lichess_db_puzzle.csv --count 50000`. It's
   zero-downtime (additive `skipDuplicates`, live reads never block; see §4).
4. **Flush the catalog cache** so the theme histogram + counts reflect new rows
   immediately: `redis-cli -u "$REDIS_URL" DEL puzzle:catalog:themes`. (The
   daily-puzzle cache `puzzle:daily` and tablebase cache `endgame:tb:*` are
   unaffected by a bank refresh and need no flush.)
5. **Verify** (step 3): count ≈ 50k+ (monotonic — only grows), rating spread
   sane, `EXPLAIN` shows index scans, no `Seq Scan on "Puzzle"`.
6. **Delete the dump** from the operator box.

Rollback: a refresh only *adds* rows, so there's nothing to roll back functionally
(no existing puzzle changed). If a bad seed (wrong file) inserted garbage ids,
delete them by id prefix and re-seed; the pre-seed backup from step 1 is the
belt-and-braces restore path.

## 6. Synthetic fallback (no real dump available)

When the real lichess dump isn't present (CI, a fresh dev box, perf/scale
testing), generate a **synthetic** CSV with the exact lichess header and feed it
to the same seeder — the bank reaches production volume without the download:

```sh
# from apps/api — writes to a git-ignored *.puzzle.csv path (never /repo)
pnpm exec ts-node --project tsconfig.seed.json \
  scripts/gen-synthetic-puzzles.ts /tmp/synthetic.puzzle.csv --count 50000
pnpm db:seed-puzzles /tmp/synthetic.puzzle.csv --count 50000
```

The synthetic rows spread ratings 600–2800 (bell-curve mass at 1200–1900), draw
1–4 themes from the real lichess vocabulary, and pair each (real, legal) FEN with
a legal first move so the local solve loop accepts the "solution". They are NOT
real tactics — use them only to exercise the selection queries + indexes at
scale, never to serve real users. For E2E, also seed a handful of verified
mate-in-1 fixtures tagged `e2etest`:

```sh
pnpm exec ts-node --project tsconfig.seed.json scripts/seed-e2e-fixtures.ts
```

Neither the generated CSV nor any generated data is committed (`*.puzzle.csv` is
git-ignored).
