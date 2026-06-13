# purechess-improve — epic closeout

**Status:** shipped. 16 sessions, branch `epic/purechess-improve`.
**Thesis:** make Purechess about *measurable rating gain*, not feature count.
Tactics is the #1 ELO lever under ~2000, so the spine is the puzzle loop; openings,
endgames, insights, and the hub are supporting pillars.

## What shipped

| Pillar | Surface | Server |
|---|---|---|
| Local puzzle bank | seeded from lichess CC0 dump | `Puzzle` table, `seed-puzzles.ts`, `PuzzleCatalogService` |
| Theme trainer | `/puzzles/train` | `PuzzleServingService.getNext/getStats`, per-user Glicko |
| Per-user puzzle rating | (powers serving + stats + charts) | `PuzzleRatingService` (reuses game Glicko verbatim) |
| Daily puzzle | `/puzzles` | lichess proxy, Redis 24h cache |
| Puzzle rush | `/puzzles/rush` | `PuzzleRushService` (PB in Redis hash) |
| Spaced-rep review | `/puzzles/review` | `PuzzleReviewService` (SM-2, `PuzzleReview`) |
| Mistakes-from-your-games | review-page trainer | `GameMistakeService` (server-verified) |
| Adaptive difficulty (opt-in) | serving flag | `adaptive-selector.ts` (damped controller) |
| Stats + charts | `/puzzles/stats`, profile pill | `PuzzleHistoryService` (derived from attempts) |
| Opening repertoire + drill | `/openings` | `RepertoireService` + `RepertoireReviewService` (SM-2 reused) |
| Endgame drills | `/endgames` | `EndgamesService` + `TablebaseService` (lichess proxy) |
| Insights | `/train/insights` | `InsightsService` (pure detectors, no LLM) |
| Training hub + streak | `/train` | `TrainingService` + `StreakService` (UTC-day) |
| Analytics | training funnel | `lib/analytics/training-events.ts` (PostHog) |

Hardened in S15 (a11y/mobile/motion), instrumented + perf-proven + E2E-locked +
documented in S16.

## Success-metric measurements (S16)

Measured against a **50,000-puzzle bank + a 400-attempt user** on local Postgres
(`EXPLAIN (ANALYZE, BUFFERS)`; p95 from 120 timed runs after 10 warmup):

| Metric | Target | Measured |
|---|---|---|
| `getNext` p95 (rating window, exclude-seen) | < 80 ms | **2.63 ms** |
| `getNext` p50 | — | 1.67 ms |
| `getNext` tier-0 + theme (BitmapAnd of both indexes) | no seq-scan | **1.55 ms** |
| `getStats` (newest ≤1000 attempts, payload-capped) | bounded | **0.51 ms** |
| `getDue` (review queue) | bounded | **0.01 ms** |
| Index used by `getNext` | rating B-tree | `Bitmap Index Scan on Puzzle_rating_idx` ✓ |
| Index used by themed `getNext` | rating B-tree + themes GIN | `BitmapAnd(Puzzle_themes_idx, Puzzle_rating_idx)` ✓ |
| Anti-join (unseen filter) | indexed | `Hash Anti Join` (small `PuzzleAttempt` seq-scans below ~thousands/user, as expected) |

**No index-only migration was needed** — the S01 indexes (`Puzzle_rating_idx`
B-tree, `Puzzle_themes_idx` GIN) carry the hot paths at production volume. The
`ORDER BY random() LIMIT 1` is cheap because it runs a top-N heapsort over the
*already-narrowed* matched set (≤13k rows for a ±150 window), not the full 50k.

**Caches verified hitting:** daily-puzzle (`puzzle:daily`, 12 ms warm read),
theme histogram (`puzzle:catalog:themes`, flush-on-refresh confirmed), tablebase
(`endgame:tb:*`, 30-day TTL). `getStats`/history bucketing caps payload (≤1000
attempts read; history ≤200 rated attempts → daily-close buckets).

**Bundle:** Stockfish is lazy-loaded only where a mode needs it — endgame drills
import `@/lib/engine/stockfish-client`; the theme trainer / rush / review solve
loops (`useLocalPuzzle`) do **not**, so the engine doesn't ship with the tactics
trainer.

## Analytics — the documented training event set

All fire through `apps/web/src/lib/analytics/training-events.ts` (consent-gated
via the existing `@/lib/posthog` wrapper; `streak_advanced` fires server-side via
`PosthogService`). One taxonomy, no second analytics client:

| Event | Props | Where |
|---|---|---|
| `training_plan_viewed` | `itemCount` | daily-plan mount |
| `puzzle_started` | `source, theme` | each puzzle load (daily/theme) |
| `puzzle_solved` | `source, theme, rating` | solve (daily/theme/rush/review) |
| `puzzle_failed` | `source, theme, rating` | fail/incorrect |
| `rush_run_finished` | `mode, score` | rush end |
| `review_session_completed` | `count` | review queue exhausted |
| `opening_drill_completed` | `lines, accuracy` | opening drill summary |
| `endgame_attempt` | `slug, succeeded` | endgame drill finish |
| `insight_viewed` | `kind` | insight card render |
| `insight_action_clicked` | `kind` | insight CTA click |
| `streak_advanced` | `n` | server, when the streak actually grows |

## Prioritized deferred backlog

1. **Enable the S14 adaptive opt-in flag by default** (highest leverage). The
   damped-controller serving (`adaptive: true`) is built, tested, and opt-in so it
   couldn't disturb the S03 selection tests. Flip it on by default once a small
   live A/B confirms it improves the productive-struggle band (75–85%) without
   tanking solve rate. This is the single biggest "make users better faster" lever
   already sitting behind a flag.
2. **Durable rush run table** (`PuzzleRun`). Rush PBs live in a Redis hash because
   the schema was frozen; a real table unlocks run history, leaderboards, and
   rush rating charts. Needs a post-freeze migration. Per-attempt `PuzzleAttempt`
   already persists, so no data is lost today — only the run-level ledger.
3. **Populate `GameMistake.themeGuess`** with a real motif tagger. The column
   exists and feeds the insights recurring-mistake detector, but is unpopulated;
   a lightweight tagger (pattern over the best line / piece deltas) would sharpen
   "you keep missing back-rank tactics"-style insights.
4. **More endgame drills.** 25 curated `EndgameDrill` rows ship today (every
   tablebase-verified). Expand the bank (more rook endings, opposite-coloured
   bishops, practical K+P races) — additive seed, no schema change.
5. **Social / competitive layer.** Rush leaderboards, friend streak comparisons,
   shared repertoires. Depends on (2) for durable run data and is a net-new
   surface; deferred deliberately (the thesis is *individual* rating gain first).
6. **Per-user-timezone streak boundary.** Streaks are UTC-day today (documented,
   un-gameable, deterministic). Storing a per-user tz and shifting the day key
   would feel more natural near midnight — no schema change needed, just the tz.
7. **SM-2 on game mistakes.** Mistakes are a flat backlog (oldest-first); a true
   spaced schedule needs SR columns on `GameMistake` (post-freeze migration).
