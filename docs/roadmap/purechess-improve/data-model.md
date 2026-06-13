# Improve epic — data model

> **Schema is FROZEN after Session 01.** Every table and column the epic needs
> landed in the single migration `20260613181114_improve_foundation`. No later
> session edits `apps/api/prisma/schema.prisma`. If a column turns out missing,
> record it in the session handoff for an S01 amendment — do not add it ad hoc.

Source of truth: `apps/api/prisma/schema.prisma`. This doc is the human map so
Wave 3 sessions never need to open the schema.

## ER sketch

```
User (existing)
 ├─1:N─ PuzzleAttempt ──N:1── Puzzle
 ├─1:1─ PuzzleRating
 ├─1:N─ PuzzleReview  ──N:1── Puzzle      (unique userId+puzzleId)
 ├─1:N─ GameMistake                        (unique gameId+ply+userId)
 ├─1:N─ Repertoire ──1:N── RepertoireReview
 ├─1:N─ RepertoireReview
 ├─1:1─ TrainingStreak
 ├─1:N─ TrainingDay                        (unique userId+day)
 └─1:N─ EndgameAttempt ──N:1── EndgameDrill (seeded, not user data)

Puzzle (seeded bank, id = lichess PuzzleId)
EndgameDrill (seeded curated set, slug-keyed)
```

`GameMistake.gameId` is a plain `String` (NOT a FK to `Game`) — mistakes are
derived client-side and a referenced game may be a computer game or a position
with no `Game` row; keeping it loose avoids a hard FK that would block ingestion.

## Models, columns, indexes (the frozen contract)

### Puzzle — seeded bank
`id` is the **lichess PuzzleId** (String PK), so re-seeds upsert idempotently.

| column | type | notes |
|---|---|---|
| id | String @id | lichess PuzzleId |
| fen | String | start position |
| moves | String[] | solution line, UCI; `moves[0]` = opponent setup move |
| rating | Int | lichess puzzle rating |
| ratingDeviation | Int @default(0) | |
| popularity | Int @default(0) | |
| plays | Int @default(0) | NbPlays in the dump |
| themes | String[] | lichess theme slugs |
| openingTags | String[] | lichess opening family slugs |
| createdAt | DateTime @default(now()) | |

Indexes: `@@index([rating])` (B-tree, rating-range selection) and
`@@index([themes], type: Gin)` (GIN, `theme = ANY(themes)` array-contains).
Relations: `attempts PuzzleAttempt[]`, `reviews PuzzleReview[]`.

### PuzzleAttempt — append-only solve record (server-authoritative)
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| puzzleId | String | FK Puzzle, cascade |
| solved | Boolean | client reports this |
| msToSolve | Int? | client reports this |
| ratingBeforeUser | Int? | server stamps |
| ratingAfterUser | Int? | server stamps |
| source | PuzzleAttemptSource @default(theme) | enum |
| createdAt | DateTime @default(now()) | |

Indexes: `@@index([userId])`, `@@index([userId, puzzleId])` (unseen-selection /
"have I seen this"), `@@index([userId, createdAt])` (recent feed, stats window).

### PuzzleRating — per-user puzzle Glicko (PK = userId)
Mirrors the `Rating` model's Glicko fields but as **Float** (updated every
attempt; each attempt is its own rating period). Reuses
`apps/api/src/ratings/glicko2.ts`.

| column | type | notes |
|---|---|---|
| userId | String @id | FK User, cascade |
| rating | Float @default(1500) | |
| deviation | Float @default(350) | |
| volatility | Float @default(0.06) | |
| updatedAt | DateTime @updatedAt | |

### PuzzleReview — SM-2 spaced repetition
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| puzzleId | String | FK Puzzle, cascade |
| dueAt | DateTime | next review timestamp |
| intervalDays | Int @default(0) | |
| easeFactor | Float @default(2.5) | SM-2 EF |
| lapses | Int @default(0) | |
| reps | Int @default(0) | |
| createdAt / updatedAt | DateTime | |

Unique `@@unique([userId, puzzleId])`; index `@@index([userId, dueAt])` for the
"due today" queue (`WHERE userId = ? AND dueAt <= now() ORDER BY dueAt`).

### GameMistake — blunder from your own game
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| gameId | String | NOT a FK (see note above) |
| ply | Int | |
| fen | String | position before the mistake |
| playedUci | String | the blunder |
| bestUci | String | engine best |
| bestLineUci | String[] | engine PV |
| cpLoss | Int | centipawn loss |
| themeGuess | String[] | inferred themes |
| reviewed | Boolean @default(false) | |
| createdAt | DateTime @default(now()) | |

Unique `@@unique([gameId, ply, userId])` (idempotent re-review); index
`@@index([userId, createdAt])` (recent-mistakes feed).

### Repertoire — opening tree
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| name | String | |
| color | RepertoireColor | enum white/black |
| rootFen | String | usually the start position |
| treeJson | Json | the move tree |
| createdAt / updatedAt | DateTime | |

Index `@@index([userId])`. Relation `reviews RepertoireReview[]`.

### RepertoireReview — per-node spaced repetition
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| repertoireId | String | FK Repertoire, cascade |
| nodePath | String | identifies the node in treeJson |
| dueAt | DateTime | |
| intervalDays | Int @default(0) | |
| easeFactor | Float @default(2.5) | |
| reps | Int @default(0) | |
| lapses | Int @default(0) | |
| createdAt / updatedAt | DateTime | |

Index `@@index([userId, dueAt])`.

### EndgameDrill — curated, seeded (not user data)
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| slug | String @unique | stable URL/seed id |
| name | String | |
| category | EndgameCategory | enum |
| fen | String | |
| objective | EndgameObjective | enum win/draw |
| targetDtm | Int? | distance-to-mate hint |
| difficulty | Int @default(0) | |
| createdAt | DateTime @default(now()) | |

Relation `attempts EndgameAttempt[]`.

### EndgameAttempt — pass/fail record (server-authoritative)
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| drillId | String | FK EndgameDrill, cascade |
| succeeded | Boolean | |
| movesPlayed | Int @default(0) | |
| createdAt | DateTime @default(now()) | |

Index `@@index([userId, drillId])`.

### TrainingStreak — streak + daily goal (PK = userId)
| column | type | notes |
|---|---|---|
| userId | String @id | FK User, cascade |
| currentStreak | Int @default(0) | |
| longestStreak | Int @default(0) | |
| lastTrainedOn | DateTime? @db.Date | calendar date, no time |
| dailyGoalPuzzles | Int @default(10) | |
| updatedAt | DateTime @updatedAt | |

### TrainingDay — one calendar day of activity
| column | type | notes |
|---|---|---|
| id | String @id @default(cuid) | |
| userId | String | FK User, cascade |
| day | DateTime @db.Date | calendar date |
| puzzlesSolved | Int @default(0) | |
| reviewsDone | Int @default(0) | |
| drillsDone | Int @default(0) | |

Unique `@@unique([userId, day])` (one row per user per day; upsert on it).

## Enum choices (Postgres native enums)

Native enums chosen for stable, closed sets — they self-document in the DB and
constrain bad values at the column level. Open/extensible vocabularies
(`Puzzle.themes`, `openingTags`, `GameMistake.themeGuess`) stay `String[]`
because lichess can add theme slugs at any time.

| enum | values |
|---|---|
| `PuzzleAttemptSource` | `theme`, `daily`, `rush`, `review`, `mistake` |
| `RepertoireColor` | `white`, `black` |
| `EndgameCategory` | `basic_mate`, `king_pawn`, `rook`, `minor`, `queen`, `other` |
| `EndgameObjective` | `win`, `draw` |

(Existing enums reused, not redefined: `TimeControlCategory`, `GameResult`, etc.)

## Index rationale (verified)

`EXPLAIN` of the hot selection query
(`WHERE rating BETWEEN ? AND ? AND ? = ANY(themes) ORDER BY popularity DESC LIMIT 20`)
on the empty bank chooses a Bitmap Index Scan on `Puzzle_rating_idx`. At 50k
rows the planner can also use `Puzzle_themes_idx` (GIN) when a theme filter is
more selective than the rating band. Both indexes exist; S02/S03 must re-run
`EXPLAIN` after seeding 50k rows and confirm no seq-scan on `Puzzle` (DoD).

All per-user feeds/queues are covered by composite `(userId, *)` indexes so a
user's data is never seq-scanned: attempts by `(userId, createdAt)`, review
queues by `(userId, dueAt)`, mistakes by `(userId, createdAt)`,
endgame attempts by `(userId, drillId)`, training days by `(userId, day)`.
