# Epic: Purechess Improve

> The shortest path from your last blunder to your next rating point.

This epic turns Purechess from a place you **play** chess into a place you **get better** at chess — without becoming bloated. It adds a focused **Improve** surface built on one principle: every minute a user spends here should move their rating. No content farm, no gamified clutter. A tight loop:

```
Play a game → see your mistakes → drill the exact pattern you missed →
measure that it's improving → repeat on your next weakest thing.
```

The single biggest ELO lever below 2000 is **tactical pattern recognition and not blundering**. So tactics is the spine. Around it we add the supporting pillars (openings you actually play, endgames you actually reach, and an insight layer that tells you what to work on next) — each earning its place by being directly rating-relevant.

## Why this improves ELO (the thesis)

| Lever | Impact band | What we build |
|---|---|---|
| Tactical vision (spotting forks/pins/mates) | Huge, all levels < 2000 | Themed puzzle trainer at your rating, adaptive difficulty |
| Not hanging pieces / board vision under pressure | Huge, < 1600 | Puzzle Rush (timed), spaced repetition of your own failures |
| Learning from your own losses | Large, all levels | Mistakes-from-your-games → auto-generated puzzles |
| Opening leaks (out of book by move 6) | Medium, 1200–2000 | Repertoire trainer (drill *your* lines, spaced) |
| Endgame technique (winning won positions) | Medium, all levels | Endgame drills vs tablebase |
| Knowing what to work on | Multiplier | Insights engine + daily training plan |
| Consistency / showing up | Multiplier | Streaks, goals, a daily plan that's 10 minutes |

Everything else is downstream of these. If a session is tempted to add a feature that does not move one of these levers, it re-scopes.

## What already exists (the starting line)

Session work already shipped a **daily puzzle** that proves the solve loop end-to-end:

- `apps/api/src/puzzles/` — NestJS module proxying `GET https://lichess.org/api/puzzle/daily`, Redis-cached 24h. Public, no DB.
- `apps/web/src/hooks/use-puzzle.ts` — solve state machine (`loading → setup → player → auto-reply → success/fail → reveal`).
- `apps/web/src/components/puzzle/puzzle-board.tsx` — board + overlays, theme humanizer, procedural sound feedback.
- `apps/web/src/lib/board/puzzle-utils.ts`, `apps/web/src/lib/api/puzzles.ts`, `apps/web/src/app/puzzles/` (daily page).

This epic **builds on** that. It does not rebuild it. The daily puzzle stays; everything new is DB-backed training around it.

Also reused, not rebuilt:
- **Glicko-2** lives in `RatingsService` (`apps/api/src/ratings/`) — puzzle rating reuses it.
- **Move classification / accuracy** (client-side Stockfish, the `useMoveClassifier` hook + accuracy work in review) — feeds mistakes-from-your-games.
- **Chessboard, sound, SR narration, premoves, keyboard play** — every training mode renders the existing `<Chessboard>`; no second board implementation.
- **recharts rating chart** (`apps/web/src/components/profile/rating-chart.tsx`) — puzzle-rating history chart reuses it.
- **Stockfish Web Worker** (`stockfish-client.ts`) — endgame defender + mistake-PV generation.

## Architecture

```
                         Browser (Next.js)
   /train  /puzzles  /puzzles/train  /puzzles/rush  /puzzles/review
        /openings  /endgames  /puzzles/stats  /train/insights
                         │  REST + existing <Chessboard> + Stockfish worker
                         ▼
                      NestJS API
   puzzles · puzzle-ratings (Glicko) · review (spaced rep) · repertoire
   · endgames · insights · training (hub/plan/streaks)
                         │
            ┌────────────┴───────────┐
            ▼                        ▼
   PostgreSQL (Prisma)          Redis (ioredis)
   Puzzle, PuzzleAttempt,       daily puzzle cache,
   PuzzleRating, PuzzleReview,  rush-set assembly,
   GameMistake, Repertoire,     selection cooldowns
   RepertoireReview, EndgameDrill,
   EndgameAttempt, TrainingStreak
                         ▲
                         │  one-time seed (CC-licensed)
            database.lichess.org puzzle CSV  (~4M puzzles, we take top-N by popularity)
   tablebase.lichess.ovh (endgame ground truth, public API)
```

Server-authoritative where it matters (puzzle rating, attempt records, streaks are written server-side and never trusted from the client). Solve interaction and endgame defense run client-side for latency — the server records *outcomes*, not keystrokes.

## Data sources & licensing

- **Puzzle bank**: `database.lichess.org` puzzle dump — CC0 / public domain. CSV columns: `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags`. We seed the top-N by popularity (default 50k) into our own Postgres so selection queries are ours and fast. The dump is **not** committed; an operator downloads it and runs the seed (documented in the ingestion session + a runbook).
- **Tablebase**: `https://tablebase.lichess.ovh/standard?fen=` — public, for endgame drill ground truth. Cached in Redis.
- **Daily puzzle**: existing `lichess.org/api/puzzle/daily` proxy — unchanged.

## Non-goals (explicit)

Out of scope for this epic — push back and re-scope if tempted:

- Puzzle Storm/Streak social leaderboards, friend challenges, puzzle racing against others.
- User-submitted puzzles, puzzle voting/reporting, theme curation tooling.
- Video lessons, articles, courses, written theory content.
- A coach chatbot / LLM tutor. ("Coach feedback" in S14 is static, deterministic microcopy + engine lines, not generative.)
- Cloud engine analysis (analysis stays client-side Stockfish).
- Cross-user puzzle rating ladders or global ranks.
- Native apps.

## Sessions overview (16 implementation sessions + operator rules, 6 waves)

### Wave 0 — Charter (sequential, blocking)

| # | Session | What it builds |
|---|---------|----------------|
| 00 | [Operator rules](../claude-sessions/purechess-improve/session-00-operator-rules.md) | Shared rules every session obeys |
| 01 | [Charter, data model & Improve IA](../claude-sessions/purechess-improve/session-01-charter-data-model.md) | **All** Prisma schema additions, shared DTOs, `/train` `/openings` `/endgames` route shells + nav, training design tokens, measurement baselines |

### Wave 1 — Puzzle backbone (after 01)

| # | Session | What it builds |
|---|---------|----------------|
| 02 | [Puzzle ingestion pipeline](../claude-sessions/purechess-improve/session-02-puzzle-ingestion.md) | Seed script (lichess CSV → Postgres), catalog/themes service, idempotent upsert, refresh runbook |
| 03 | [Puzzle serving API + Glicko rating](../claude-sessions/purechess-improve/session-03-puzzle-serving-api.md) | `next`/`attempt`/`themes`/`stats` endpoints, unseen + rating-range selection, per-user puzzle Glicko updated on every attempt |

### Wave 2 — Solve UX (after 03)

| # | Session | What it builds |
|---|---------|----------------|
| 04 | [Local solve engine + theme trainer](../claude-sessions/purechess-improve/session-04-solve-engine-theme-trainer.md) | Generalize the solve hook to DB puzzles (`useLocalPuzzle`), `/puzzles/train` with weakest-theme surfacing, session summary with before/after accuracy |

### Wave 3 — Training modes (after 04, parallel)

| # | Session | What it builds |
|---|---------|----------------|
| 05 | [Puzzle Rush (timed)](../claude-sessions/purechess-improve/session-05-puzzle-rush.md) | Board vision under the clock: score/combo, 3-strikes & 3-minute modes, local PB |
| 06 | [Spaced-repetition review](../claude-sessions/purechess-improve/session-06-spaced-repetition-review.md) | SM-2 queue for failed puzzles, `/puzzles/review`, due-today count |
| 07 | [Mistakes from your games](../claude-sessions/purechess-improve/session-07-mistakes-from-games.md) | Persist game-review blunders (session-16 accuracy) → "solve your own mistake" puzzles → into review queue |
| 08 | [Opening repertoire model + import](../claude-sessions/purechess-improve/session-08-repertoire-model-import.md) | Repertoire as tree, PGN/explorer import, CRUD |
| 09 | [Opening trainer](../claude-sessions/purechess-improve/session-09-opening-trainer.md) | Spaced-rep drilling of *your* lines, out-of-book detection |
| 10 | [Endgame drills](../claude-sessions/purechess-improve/session-10-endgame-drills.md) | Curated positions, defend vs tablebase (Stockfish fallback), pass/fail |

### Wave 4 — Intelligence & motivation (after the modes)

| # | Session | What it builds |
|---|---------|----------------|
| 11 | [Stats & charts](../claude-sessions/purechess-improve/session-11-stats-charts.md) | `/puzzles/stats`, puzzle-rating chart, per-theme accuracy table, history |
| 12 | [Insights & weakness engine](../claude-sessions/purechess-improve/session-12-insights-engine.md) | Cross-cutting read model → ranked "what to work on" (themes, opening leaks, endgame gaps, time management) |
| 13 | [Training hub, daily plan, streaks](../claude-sessions/purechess-improve/session-13-training-hub.md) | `/train` ties it together: today's 10-minute plan, streak, goals, progress |

### Wave 5 — Adapt & ship (after the hub)

| # | Session | What it builds |
|---|---------|----------------|
| 14 | [Adaptive difficulty + coach feedback](../claude-sessions/purechess-improve/session-14-adaptive-coach.md) | Tune selection by recent performance, interleave themes, static post-solve explanations |
| 15 | [A11y, mobile, motion & sound pass](../claude-sessions/purechess-improve/session-15-a11y-mobile-polish.md) | Keyboard solve + SR narration + 390px + reduced-motion across all training surfaces |
| 16 | [Analytics, perf, E2E & docs](../claude-sessions/purechess-improve/session-16-analytics-perf-e2e-docs.md) | PostHog training funnels, selection-query indexes at scale, E2E critical paths, runbook + ADR |

## Wave dependency diagram

```
Wave 0   00 ──► 01
                 │
Wave 1     ┌─────┴─────┐
           ▼           │
          02 ──► 03    │ (03 depends on 02; both own apps/api/src/puzzles, run sequentially)
           │     │     │
Wave 2     │     ▼     │
           │    04 ◄───┘
           │     │
Wave 3     │     ├──────────┬──────────┬──────────┐
           │     ▼          ▼          ▼          ▼
           │    05         06         08         10
           │     (rush)     │          │          (endgames)
           │                ▼          ▼
           │               07         09
           │            (mistakes) (opening trainer)
Wave 4     └─► 11        12 ◄── (07,09,10,11)
                          │
                          ▼
                         13
Wave 5                    │
                  14 ──► 15 ──► 16
```

Each session's `depends_on` frontmatter pins exact preconditions. Parallel siblings in Wave 3 declare non-overlapping `produces` globs; the **known merge seams** are `apps/api/src/puzzles/puzzles.module.ts` + `puzzles.controller.ts` (each mode registers its own service/route file and only appends a line), and `apps/api/prisma/schema.prisma` is **frozen after S01** (no Wave 3 session edits it — S01 lands every table the epic needs).

## Running the epic

```bash
# Preview the DAG
python scripts/epic-dag.py --show docs/claude-sessions/purechess-improve/

# Dry run
bash scripts/run-sessions.sh docs/claude-sessions/purechess-improve/ --dry-run

# Run for real (parallel waves capped)
bash scripts/run-sessions.sh docs/claude-sessions/purechess-improve/ --max-parallel 4 --strict
```

Handoffs land in `docs/roadmap/purechess-improve/session-NN-handoff.md` and name exact inputs for dependent sessions (file paths, not memory).

## Conventions across all sessions

- **OpenWolf protocol applies** — check `.wolf/anatomy.md` before reading, `.wolf/cerebrum.md` before writing code, `.wolf/buglog.json` before fixing; update them after.
- **design.md (repo root) is law** — radius 14/10/7, one brass accent, AA contrast floors. Training surfaces match the Silent Tournament voice; no new visual language.
- **Schema is frozen after S01** — all tables/columns this epic needs land in one migration in S01. No other session edits `schema.prisma`.
- **`packages/shared`** — plain TS interfaces, zero runtime deps, explicit `.js` relative imports, rebuilt after edits. New DTO fields optional.
- **Server-authoritative** for puzzle ratings, attempts, streaks, mistakes. The client renders and reports outcomes; it never sets a rating.
- **Reuse the board** — every mode renders the existing `<Chessboard>`. No second board.
- **Reuse Glicko-2** — puzzle rating calls the existing rating math, not a fresh implementation.
- **No new puzzle source at runtime** — runtime reads our Postgres; only the offline seed touches lichess's dump.
- **Tests are mutation-proof** — assert persistence, ordering, and rating deltas, not just that a mock was called. New behavior has a test that fails if the behavior is deleted.

## Definition of done (every session)

- `pnpm exec tsc --noEmit` clean in every workspace the session touched.
- Relevant suites green: `cd apps/web && pnpm exec vitest run test/` and/or `cd apps/api && pnpm test` (engine coverage gate stays green).
- New API selection queries have the indexes they need (no seq-scan on `Puzzle` at 50k rows).
- Handoff written under `docs/roadmap/purechess-improve/`, naming exact next-session inputs.
- Durable learnings recorded in `.wolf/cerebrum.md`; bugs in `.wolf/buglog.json`.

## Success metrics (what "best possible" means here)

The epic is successful when a returning user can, in one sitting:

1. Open `/train` and see a concrete 10-minute plan aimed at their weakest area.
2. Solve puzzles calibrated to their rating (puzzle Glicko within ±100 of stable after ~30 solves).
3. Re-meet a puzzle they failed last week (spaced repetition fired).
4. Drill a tactic that came from *their own* lost game.
5. Watch a per-theme accuracy number move after a focused session.

And the platform stays fast: puzzle selection p95 < 80ms at 50k puzzles, solve page interactive in < 1.5s, zero new layout shift on the board.
