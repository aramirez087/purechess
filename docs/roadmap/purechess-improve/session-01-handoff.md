# Session 01 handoff — Charter, data model & Improve IA

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema is FROZEN after this session.** No later session edits
`apps/api/prisma/schema.prisma`. Missing-column requests go through an S01
amendment noted in a handoff, never an ad-hoc add.

## What was built

1. **Prisma schema + migration `20260613181114_improve_foundation`** — all 11
   epic tables + 4 enums + back-relations on `User`, applied to the live local
   DB and client regenerated. Indexes incl. GIN on `Puzzle.themes` verified.
2. **Shared DTOs** — `packages/shared/src/dto/puzzle.dto.ts` and
   `training.dto.ts`, exported from `index.ts`, `pnpm --filter @purechess/shared build` clean.
3. **Improve route shells** — `apps/web/src/app/{train,openings,endgames}/page.tsx`
   (server components, `buildMetadata`, shared `TrainingPlaceholder`, design.md
   voice, auth-aware). `/puzzles` untouched.
4. **Nav** — `Train` (lucide `Target`) added to desktop `AppShell` nav between
   Play and Puzzles; `Train`/`Openings`/`Endgames` added to `MobileNav`.
5. **Training design tokens** — accuracy color scale in `globals.css`
   `@layer utilities` (`.acc-low/.acc-mid/.acc-high` + `-bg-`/`-border-`
   variants), built on existing `--destructive/--warning/--success`.
6. **Docs** — `data-model.md`, `baselines.md`, this handoff.

## Frozen contract — models, columns, relations

> Full column tables + index rationale in `data-model.md`. Quick reference here.

| Model | PK | Key columns | Indexes |
|---|---|---|---|
| `Puzzle` | `id` (String = lichess PuzzleId) | `fen`, `moves String[]`, `rating Int`, `ratingDeviation Int`, `popularity Int`, `plays Int`, `themes String[]`, `openingTags String[]`, `createdAt` | `@@index([rating])`, `@@index([themes], type: Gin)` |
| `PuzzleAttempt` | `id` cuid | `userId`, `puzzleId`, `solved Bool`, `msToSolve Int?`, `ratingBeforeUser Int?`, `ratingAfterUser Int?`, `source PuzzleAttemptSource`, `createdAt` | `[userId]`, `[userId,puzzleId]`, `[userId,createdAt]` |
| `PuzzleRating` | `userId` | `rating Float=1500`, `deviation Float=350`, `volatility Float=0.06`, `updatedAt` | (PK only) |
| `PuzzleReview` | `id` cuid | `userId`, `puzzleId`, `dueAt`, `intervalDays Int=0`, `easeFactor Float=2.5`, `lapses Int=0`, `reps Int=0`, `createdAt`, `updatedAt` | `@@unique([userId,puzzleId])`, `@@index([userId,dueAt])` |
| `GameMistake` | `id` cuid | `userId`, `gameId` (String, **not** a FK), `ply Int`, `fen`, `playedUci`, `bestUci`, `bestLineUci String[]`, `cpLoss Int`, `themeGuess String[]`, `reviewed Bool=false`, `createdAt` | `@@unique([gameId,ply,userId])`, `@@index([userId,createdAt])` |
| `Repertoire` | `id` cuid | `userId`, `name`, `color RepertoireColor`, `rootFen`, `treeJson Json`, `createdAt`, `updatedAt` | `@@index([userId])` |
| `RepertoireReview` | `id` cuid | `userId`, `repertoireId`, `nodePath String`, `dueAt`, `intervalDays Int=0`, `easeFactor Float=2.5`, `reps Int=0`, `lapses Int=0`, `createdAt`, `updatedAt` | `@@index([userId,dueAt])` |
| `EndgameDrill` | `id` cuid | `slug @unique`, `name`, `category EndgameCategory`, `fen`, `objective EndgameObjective`, `targetDtm Int?`, `difficulty Int=0`, `createdAt` | `@@unique([slug])` |
| `EndgameAttempt` | `id` cuid | `userId`, `drillId`, `succeeded Bool`, `movesPlayed Int=0`, `createdAt` | `@@index([userId,drillId])` |
| `TrainingStreak` | `userId` | `currentStreak Int=0`, `longestStreak Int=0`, `lastTrainedOn DateTime? @db.Date`, `dailyGoalPuzzles Int=10`, `updatedAt` | (PK only) |
| `TrainingDay` | `id` cuid | `userId`, `day DateTime @db.Date`, `puzzlesSolved Int=0`, `reviewsDone Int=0`, `drillsDone Int=0` | `@@unique([userId,day])` |

**User back-relations added** (use these names in `include`/`select`):
`puzzleAttempts`, `puzzleRating` (1:1, nullable), `puzzleReviews`,
`gameMistakes`, `repertoires`, `repertoireReviews`, `endgameAttempts`,
`trainingStreak` (1:1, nullable), `trainingDays`.

**Cascade:** every user-owned table is `onDelete: Cascade` from `User`.
`PuzzleAttempt.puzzle` and `PuzzleReview.puzzle` cascade from `Puzzle`;
`EndgameAttempt.drill` and `RepertoireReview.repertoire` cascade from their
parent. `Puzzle.attempts/reviews` and `EndgameDrill.attempts` are the
back-relations on the seeded tables.

## Frozen contract — enums (Postgres native)

```
PuzzleAttemptSource = theme | daily | rush | review | mistake
RepertoireColor     = white | black
EndgameCategory     = basic_mate | king_pawn | rook | minor | queen | other
EndgameObjective    = win | draw
```

Open vocabularies stay `String[]` (lichess can add slugs): `Puzzle.themes`,
`Puzzle.openingTags`, `GameMistake.themeGuess`.

## Shared DTOs (`@purechess/shared`)

All plain TS interfaces, optional-friendly. Import from `@purechess/shared`.

**`dto/puzzle.dto.ts`:**
- `type PuzzleSource = 'theme'|'daily'|'rush'|'review'|'mistake'`
- `PuzzleDto { id; fen; moves[]; rating; ratingDeviation?; popularity?; plays?; themes[]; openingTags? }`
- `PuzzleAttemptResultDto { puzzleId; solved; ratingBefore?; ratingAfter?; ratingDelta?; nextReviewAt? }`
- `PuzzleThemeDto { slug; label; description?; puzzleCount? }`
- `PuzzleThemeStatDto { slug; label?; attempts; solved; accuracy?; avgMsToSolve?; lastAttemptedAt? }`
- `PuzzleRatingDto { rating; deviation?; volatility?; attempts?; updatedAt? }`

**`dto/training.dto.ts`:**
- `TrainingPlanItemDto { kind: 'theme'|'review'|'rush'|'mistake'|'opening'|'endgame'; label; targetSlug?; count?; estimatedMinutes?; href?; completed? }`
- `TrainingPlanDto { date; items[]; dailyGoalPuzzles?; puzzlesSolvedToday?; estimatedMinutes? }`
- `TrainingDayDto { day; puzzlesSolved; reviewsDone; drillsDone }`
- `TrainingStreakDto { currentStreak; longestStreak; lastTrainedOn?; dailyGoalPuzzles; goalMetToday?; history? }`
- `WeaknessDto { area: 'theme'|'opening'|'endgame'|'time'; slug?; label; accuracy?; sampleSize?; estimatedEloUpside? }`
- `InsightDto { generatedAt?; headline?; weaknesses[] }`

**Rule for later sessions:** new DTO fields must be **optional** or existing
literals break the api typecheck (see cerebrum). DTO field types echo server
values read-only; the client never sets a rating/streak.

## Reuse anchors (do NOT rebuild)

- **Puzzle rating math:** `apps/api/src/ratings/glicko2.ts` — `updateRating(player, games)`,
  `DEFAULT_RATING` ({1500, 350, 0.06}). `PuzzleRating` columns map 1:1 to
  `GlickoRating { rating, ratingDeviation→deviation, volatility }`.
- **Daily puzzle module:** `apps/api/src/puzzles/` (controller/module/service/types).
  S02/S03 add their own service + controller files and register them with a
  single additive line in `puzzles.module.ts` (known merge seam).
- **Solve loop (web):** `apps/web/src/hooks/use-puzzle.ts`,
  `components/puzzle/puzzle-board.tsx`, `lib/board/puzzle-utils.ts`,
  `lib/api/puzzles.ts`. S04 generalizes the hook to DB puzzles (`useLocalPuzzle`).
- **Board / sound / SR / premove:** `apps/web/src/components/board/`. Every mode
  renders the existing `<Chessboard>`.
- **Client Stockfish:** `apps/web/src/lib/engine/stockfish-client.ts` (endgame
  defender, mistake-PV).
- **Server auth in pages:** `serverFetch<{user}>('/api/auth/me',{withAuth:true})`
  returns 200 `{user:null}` when signed out (not 4xx). The Improve shells use
  this; copy the pattern.

## Web shells — files + props

- `apps/web/src/components/improve/training-placeholder.tsx` — shared empty-state.
  Props: `{ icon: LucideIcon; eyebrow; title; description; upcoming: string[];
  signedOut?: boolean; related?: {href,label}[] }`. Later sessions replace each
  shell's body with the real client component; keep the `AppShell` wrapper +
  `buildMetadata`.
- `apps/web/src/app/train/page.tsx` → hub (auth-aware, `Target` icon)
- `apps/web/src/app/openings/page.tsx` → repertoire (auth-aware, `BookOpen`)
- `apps/web/src/app/endgames/page.tsx` → drills (auth-aware, `Castle`)

## Design tokens — accuracy scale

In `apps/web/src/app/globals.css` `@layer utilities` (NOT tailwind.config — see
cerebrum Do-Not-Repeat re: hot-reload). Banding red <50% / yellow <70% / green:
- text: `.acc-low` / `.acc-mid` / `.acc-high`
- bg: `.acc-bg-low|mid|high` (16% wash)
- border: `.acc-border-low|mid|high` (50% alpha)

Built on `--destructive/--warning/--success` so they adapt to light + dark.
Pair color with text/icon (design.md: never status-by-color-alone).

## Open issues / notes for later sessions

- **No WS needed** in this epic per the operator rules; none added. Flag in a
  handoff if any mode truly needs realtime (use the `WsEvent` enum, never raw
  strings).
- **Puzzle dump is git-ignored, never committed.** S02 owns the seed script +
  `.gitignore` entry for the CSV.
- **GameMistake.gameId is a loose String, not a FK** (computer games / ad-hoc
  positions may have no `Game` row). S07 must not assume a join to `Game`.
- **`@db.Date` columns** (`TrainingStreak.lastTrainedOn`, `TrainingDay.day`) are
  calendar dates — pick a single day-boundary convention (UTC vs server tz) in
  S13 and apply it consistently; the schema is timezone-agnostic on purpose.
- **EXPLAIN must be re-run after the 50k seed** (S02/S03) to confirm no seq-scan
  on `Puzzle` and p95 < 80 ms; the GIN may only be chosen once the bank is large
  and a theme filter is selective.

## Quality gates (all green)

- `apps/api`: `tsc --noEmit` clean; `prisma validate` → "valid 🚀".
- `packages/shared`: `pnpm build` clean (dist contains puzzle.dto + training.dto).
- `apps/web`: `tsc --noEmit` clean; `vitest run test/` → 568 passed / 71 files.
- Migration `20260613181114_improve_foundation` applied to the live DB; GIN +
  all `(userId, *)` indexes confirmed via `pg_indexes`.
