# Session 14 handoff — Adaptive difficulty + coach feedback

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits, no S01 amendment
needed — the adaptive policy reads existing `PuzzleAttempt` rows; the coach copy
is static client content.

## What was built

1. **`adaptive-selector.ts`** (`apps/api/src/puzzles/adaptive-selector.ts`) — PURE
   selection-policy functions (no DB, no side effects): `nextDifficulty`,
   `interleaveThemes`, `calibrationBand`/`isCalibrating`. All thresholds exported.
2. **Opt-in policy layer in `getNext`** (`puzzle-serving.service.ts`) —
   `getNext(userId, { theme?, rating?, adaptive? })`. `adaptive` falsy (every
   existing caller) ⇒ byte-for-byte S03. `adaptive:true` ⇒ `resolveAdaptivePolicy`
   reads the last 20 attempts and steers target/band/theme.
3. **`theme-explanations.ts`** (`apps/web/src/lib/board/theme-explanations.ts`) —
   static curated `ThemeKey → {name, oneLiner, whatToLookFor}` map + `explainTheme`
   / `explainThemes` (graceful degradation for unknown slugs). No generation.
4. **`SolveExplanation`** (`apps/web/src/components/puzzle/solve-explanation.tsx`)
   — post-solve coach panel: theme copy + a steppable read-only mini-board with
   the motif arrow drawn on the start position. Collapsible, dismissible,
   suppressed in rush + on the hide preference.
5. **`hideExplanations` preference** — added to the zustand `useSettingsStore`
   (`apps/web/src/stores/settings-store.ts`, default `false`), surfaced as a
   "Coach explanations" toggle in `settings-form.tsx`, and added to the
   `use-settings.ts` projection literal.
6. **Wired** `SolveExplanation` into `training-session.tsx` (below the board,
   `key={puzzle.id}`, `defaultCollapsed`, fires once an outcome settles).
7. **Tests** — `adaptive-selector.spec.ts` (15 cases),
   `solve-explanation.test.tsx` (8 cases).
8. **OpenWolf** — cerebrum (2 Key-Learnings blocks + 2 Decision Log entries),
   anatomy (4 new/updated entries), buglog (`bug-564` test-design fix), memory.

## 1. Quality gates — PASS/FAIL with actual final output

| Gate | Result | Final output line |
|---|---|---|
| `cd apps/api && pnpm exec tsc --noEmit` | **PASS** | `GATE1_API_TSC_EXIT=0` (clean, no output) |
| `cd apps/api && pnpm test` | **PASS** | `Test Suites: 48 passed, 48 total` / `Tests: 605 passed, 605 total` |
| `cd apps/web && pnpm exec tsc --noEmit` | **PASS** | `GATE3_WEB_TSC_EXIT=0` (clean, no output) |
| `cd apps/web && pnpm exec vitest run test/` | **PASS** | `Test Files 81 passed (81)` / `Tests 642 passed (642)` |

API tests 590 (S13) → **605** (+15 adaptive-selector). Web tests 634 (S13) →
**642** (+8 solve-explanation).

**S03 serving tests pass UNCHANGED.** `pnpm exec jest
test/puzzles/puzzle-serving.service.spec.ts` → `Tests: 17 passed, 17 total`
(target-rating resolution, NOT-EXISTS exclusion, theme containment, the ±150/
±300/±600 fallback ladder, the dropped-filter final tier, recordAttempt, and
getStats — none altered). The S03 handoff named "16 cases"; the file actually
holds 17 (one was added later); all pass with no edits. Confirmed: the adaptive
path only runs behind the opt-in `adaptive:true` flag, which no S03 test sets, so
the SQL and ladder are identical code, not just identical output.

## 2. The difficulty control law + calibration window

**`nextDifficulty(recent, currentTarget, anchor = currentTarget)`** — a DAMPED
PROPORTIONAL controller steering the user toward the productive-struggle band
(75-85% success, setpoint 80%):

```
error      = recentSuccessRate(last SUCCESS_WINDOW) - TARGET_SUCCESS
rawStep    = error * GAIN
speedBonus = +SPEED_BONUS   iff trailing run of >= FAST_STREAK_LEN fast solves
failNudge  = -FAIL_NUDGE * (failStreak - FAIL_STREAK_LEN + 1)  iff failStreak >= FAIL_STREAK_LEN
step       = clamp(rawStep + speedBonus + failNudge, -MAX_STEP, +MAX_STEP)
next       = round(clamp(currentTarget + step, anchor - BAND, anchor + BAND))
```

**EMPTY `recent` ⇒ `round(currentTarget)` unchanged** (the no-op guarantee).

| Constant | Value | Role |
|---|---|---|
| `TARGET_SUCCESS` | `0.80` | success setpoint (centre of the band) |
| `PRODUCTIVE_BAND_LOW` / `_HIGH` | `0.75` / `0.85` | the documented band |
| `GAIN` | `800` | proportional gain (Elo per unit success-error), steady state |
| `MAX_STEP` | `60` | max Elo per single call (damping), steady state |
| `BAND` | `300` | hard bound: result stays within `anchor ± 300` |
| `SPEED_BONUS` | `25` | upward nudge on a clean fast-solve streak |
| `FAST_SOLVE_MS` | `8000` | a solve under this counts as "fast" |
| `FAST_STREAK_LEN` | `3` | trailing fast-solve run that triggers the bonus |
| `FAIL_NUDGE` | `20` | downward nudge per consecutive trailing fail (past the 2nd) |
| `FAIL_STREAK_LEN` | `2` | trailing fail run before the nudge engages |
| `SUCCESS_WINDOW` | `10` | attempts the success-rate term averages over |

**Calibration window = `< CALIBRATION_ATTEMPTS (8)` recorded attempts.** While
calibrating, `nextDifficulty` uses a bigger gain (`CALIBRATION_GAIN = 1400`) and a
bigger step cap (`CALIBRATION_MAX_STEP = 140`) so a new user's level is found in a
few solves, and `calibrationBand` returns a **wider** first-tier half-window
(`CALIBRATION_BAND_HALF = 350`) vs the steady `STEADY_BAND_HALF = 150` (which
equals the S03 ladder's first tier — so post-calibration the window is identical
to S03). After the 8th attempt the steady damped law applies.

**`interleaveThemes(weakThemes, recentThemes)`** — bias toward the weakest theme
but never serve the same theme more than `MAX_SAME_THEME_RUN = 2` in a row
(SPACING beats BLOCKING for retention). Returns the chosen slug, or `null`
(unfiltered) when there are no weak themes or the only weak theme is the one
currently blocked by the run cap.

**Wiring (`resolveAdaptivePolicy`, opt-in):** reads the last `ADAPTIVE_WINDOW = 20`
attempts (newest-first from the DB, then reversed so the policy sees them
most-recent-LAST), maps to `RecentResult[]`, computes `nextDifficulty(recent,
baseTarget, baseTarget)` for the target, `calibrationBand(recent.length)` for the
tier-0 half-width, and — only when no explicit theme was requested —
`interleaveThemes(weakestThemeSlugs, recentThemes)`. Weak slugs come from
`getStats` (accuracy ASC) filtered to `attempts >= 3`. An explicit `theme` arg
short-circuits the interleave.

## 3. Theme-explanation coverage + the hide-explanations preference key

**Curated themes (`THEME_EXPLANATIONS`, lichess slugs):** `fork`, `pin`,
`skewer`, `discoveredAttack`, `discoveredCheck`, `doubleCheck`, `backRankMate`,
`smotheredMate`, `deflection`, `decoy`, `attraction`, `removingTheDefender`,
`capturingDefender`, `hangingPiece`, `trappedPiece`, `zwischenzug`, `intermezzo`,
`sacrifice`, `clearance`, `interference`, `promotion`, `underpromotion`,
`enPassant`, `zugzwang`, `defensiveMove`, `quietMove`, `mateIn1`, `mateIn2`,
`mateIn3`, `mate` (30 entries). Each is `{name, oneLiner, whatToLookFor}`,
plain and instructional, hand-written, NO generation.

**Graceful degradation:** unknown slug ⇒ `explainTheme` returns
`{name: humanized(slug), oneLiner: '', whatToLookFor: ''}` so the UI shows a label
but never fabricates copy. Callers MUST use `explainTheme` / `explainThemes`,
never index the map directly. `explainThemes(slugs, limit = 2)` dedupes by name
and caps the panel at 2 themes.

**Hide-explanations preference key: `hideExplanations`** — a `boolean` on the
zustand `useSettingsStore` (`apps/web/src/stores/settings-store.ts`), default
`false` (explanations shown). The settings-form toggle is **inverted** ("Coach
explanations" ON ⇒ `hideExplanations: false`). `SolveExplanation` reads it via
`useSettingsStore((s) => s.hideExplanations)` and returns `null` when set (and
always returns `null` when `source === 'rush'`).

## 4. Deviations + notes

- **Adaptive layer is OPT-IN (`adaptive?: boolean`), not auto-enabled.** The spec
  said "wire as an optional policy layer; default behavior unchanged with no
  history." I made it opt-in via a flag rather than auto-detecting history,
  specifically so the new `puzzleAttempt.findMany` read can't perturb the S03
  serving mocks. Empty history is a no-op regardless, but opt-in guarantees the
  default path is the *same code*, not just the same output. **No caller passes
  `adaptive:true` yet** — `TrainingSession.fetchNextPuzzle` still calls the
  default path. Turning it on is a one-line change at the call site
  (`fetchNextPuzzle({ theme, adaptive: true })`) once a thin client/route param
  is added; the server side is ready. Flagged for a later session if product
  wants adaptive on for theme/daily.
- **Files touched outside the spec's `touches:` globs** (all required by spec
  tasks 4-5, "store in the existing settings store" + "respect a hide
  preference"): `apps/web/src/stores/settings-store.ts`,
  `apps/web/src/hooks/use-settings.ts` (the projection literal needs the new
  field or web tsc fails TS2741), and `apps/web/src/components/settings/
  settings-form.tsx` (the user-facing toggle). These are additive and optional;
  no existing behavior changes.
- **`SolveExplanation` surfaces BELOW the board, collapsed by default**, rather
  than as a blocking overlay — theme mode auto-advances after 1.2s, so a blocking
  overlay would fight the flow. Collapsed-by-default keeps the quick loop fast
  while making the lesson one click away. In review/daily (slower, no
  auto-advance) the same component is equally usable (and could be passed
  `defaultCollapsed={false}` / an `onDismiss`).
- **The "why it works" key motif = the solver's FIRST move drawn on the START
  position** (`bestMoveArrow(moves[0], 'green')` → `autoShapes`), cleared once the
  user steps into the line. The full line is also a clickable move list that
  drives the read-only mini-board (`buildFrames` precomputes the FEN at each ply
  via `applyUci`, defensively breaking on unapplyable data).
- **No WS, no schema change, no new hot query on `Puzzle`.** The adaptive read is
  one `puzzleAttempt.findMany` (last 20, `[userId, createdAt]` index) plus the
  existing `getStats` read — both bounded, neither touches the 50k `Puzzle` bank,
  so the S01 index plan is unaffected (EXPLAIN not re-run, no new `Puzzle` query
  shape).
- **`bug-564`** logged: two adaptive-selector spec assertions were test-design
  errors (a "steady" window that ended in a fail run engaged the fail nudge; two
  6/10 windows both clamped at `MAX_STEP`, masking the fail-nudge difference) —
  fixed by building windows that isolate the term under test. The control law
  itself was correct.

## Inputs for dependent sessions

- **Turn adaptive on:** `serving.getNext(userId, { theme?, rating?, adaptive:
  true })` server-side, or thread a flag through `fetchNextPuzzle` on the web.
  Empty history is a safe no-op; with history it steers difficulty + interleaves
  weak themes. Tunable constants are all exported from
  `apps/api/src/puzzles/adaptive-selector.ts`.
- **Reuse the coach panel:** `<SolveExplanation themes fen solutionMoves source
  onDismiss? defaultCollapsed? />` from
  `apps/web/src/components/puzzle/solve-explanation.tsx`. It is self-gating (rush
  + `hideExplanations`). Add a new theme by editing the static
  `THEME_EXPLANATIONS` map in `apps/web/src/lib/board/theme-explanations.ts` —
  unknown slugs already degrade gracefully.
- **The hide preference** lives at `useSettingsStore().hideExplanations`
  (boolean). Any other surface that wants to honor it reads the same key.

**Commit:** see the S14 commit on `epic/purechess-improve` (message
`feat(improve): S14 adaptive difficulty + coach feedback`).
