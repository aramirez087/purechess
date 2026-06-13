# apps/api/scripts

One-off operational scripts run via the package's `db:*` npm scripts. They
instantiate `PrismaClient` directly (no Nest DI) and read `DATABASE_URL` from
`.env`.

## seed-puzzles.ts

Ingests the lichess CC0 puzzle dump into our `Puzzle` table.

```sh
# from apps/api
pnpm db:seed-puzzles ./lichess_db_puzzle.csv --count 50000 [--min-popularity 80]
```

- Streams the (multi-GB) CSV line-by-line and keeps the top `--count` rows by
  popularity in O(count) memory via a bounded min-heap.
- Idempotent: `createMany({ skipDuplicates: true })` on the lichess `PuzzleId`
  PK, so re-runs add only new rows.
- The dump is **never committed** (git-ignored: `lichess_db_puzzle.csv`,
  `*.puzzle.csv`).

The pure parse/selection helpers (`parseRow`, `validateHeader`,
`PopularityHeap`, `parseArgs`) are exported and unit-tested in
`test/puzzles/seed-puzzles.spec.ts` — no DB needed.

**Full procedure** (download, license, verify, zero-downtime refresh):
see [`docs/runbooks/puzzle-db-refresh.md`](../../../docs/runbooks/puzzle-db-refresh.md).
