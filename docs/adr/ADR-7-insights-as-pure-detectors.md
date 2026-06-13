# ADR-7: Insights as pure detectors over existing signals

**Status:** Accepted (purechess-improve epic, 2026-06)

## Decision

The "what should I work on?" insights surface is built from a set of **pure,
deterministic weakness detectors** that read **already-aggregated training
signals** — never a live engine, never an LLM, never a new data source. Each
detector is a pure function `(aggregated input) → WeaknessDto | null`,
independently unit-tested; a thin orchestrator does only the DB reads and the
ranking.

## Context

A player improves fastest when told the *one* thing costing them the most rating,
with evidence. The naive implementations — call an LLM to "analyze my games", or
re-run an engine over every position — are slow, non-deterministic, expensive,
and hard to test. We already compute every signal a good coach needs:

- per-theme accuracy (`PuzzleServingService.getStats`, weakest-first),
- recurring game mistakes (`GameMistake` rows, `cpLoss >= 150`),
- opening-line lapses (`RepertoireReview` misses),
- endgame gaps (`EndgameAttempt`: attempted-but-never-solved),
- time management (`Move.moveTimeMs` + persisted blunder markers + flag losses).

### Why pure detectors over an engine/LLM

- **Trust.** A bogus "you have a time-management problem" nudge is the fastest way
  to lose a user's trust. Pure detectors are exhaustively unit-tested on
  positive, noise, insufficient-data, and empty inputs (the weakness-detector
  suite is the trust-critical test in the epic). An LLM's output can't be pinned
  the same way.
- **Determinism + speed.** A detector is a synchronous function over numbers the
  DB already has. The insights response is computed from a handful of bounded
  reads and cached in Redis (`insights:<userId>`, TTL 900s) — no engine spin-up,
  no token spend, no network to an LLM provider.
- **No new data, schema-frozen.** Every detector reads existing tables. The
  time-management read is fully read-only: it uses `Move.moveTimeMs` for speed and
  the already-persisted `GameMistake.cpLoss` rows as per-move blunder markers —
  the FEN trail is **not** re-evaluated by an engine.

### Conservatism is the core design rule

Every detector enforces **a volume floor AND a clear gap** before firing, and
returns `null` (silence) below the floor rather than a low-confidence card —
silence beats a false weakness. Thresholds are exported constants
(`THEME_MIN_ATTEMPTS=15`, `THEME_WEAK_ACCURACY=0.65`, `RECURRING_MISTAKE_MIN=3`,
`OPENING_LEAK_MIN_LAPSES=3`, `ENDGAME_GAP_MIN_UNSOLVED=2`). The most aggressive
detector, time management, additionally requires a **baseline comparison**: the
fast-move blunder rate must be ≥ 2× the user's overall blunder baseline, so a
uniformly-blundery player isn't misdiagnosed as having a clock problem.

### Ranking is also pure

`rankWeaknesses` drops nulls, dedupes by `kind` (keeps the strongest per domain),
sorts by `score = severity × estimatedEloUpside`, and caps at 5 — all pure and
exported. Theme commonness weighting (`themeCommonness(slug)`) makes a weak
high-leverage motif (e.g. `fork`) outrank a weaker rare one (`enPassant`).

## Consequences

- The reasoning layer is testable in isolation and cheap to run; the orchestrator
  is just I/O + ranking.
- No engine or LLM dependency in the insights request path; the only external
  read in the whole Improve surface is the tablebase proxy (endgames) and the
  daily-puzzle proxy — both Redis-cached and degrade-to-safe.
- Adding a new weakness type = add one pure detector + one gatherer + tests; the
  ranking and caching are unchanged.
- A detector can only be as good as the signal feeding it: e.g. richer
  game-mistake theme tagging (`GameMistake.themeGuess`) would sharpen the
  recurring-mistake detector. That tagger is captured in the closeout backlog.
