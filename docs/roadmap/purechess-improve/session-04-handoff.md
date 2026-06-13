# Session 04 handoff — Local solve engine + theme trainer

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits.

## What was built

1. **Shared solve helpers** (`apps/web/src/lib/board/puzzle-utils.ts`) — three
   pure functions extracted so both the daily and local hooks share ONE
   implementation: `uciToIntent(uci)`, `applyUci(fen,uci)` (normalize rook-square
   castle → `applyMoveToFen` → `{fen, lastMove}|null`), `solvingColorFromFen(fen)`.
   The daily hook (`use-puzzle.ts`) was refactored to import these (it previously
   inlined `uciToIntent`/`applyUci`). **Its tests still pass byte-for-byte.**
2. **`useLocalPuzzle`** (`apps/web/src/hooks/use-local-puzzle.ts`) — the DB-puzzle
   solve state machine. No setup phase. Reusable solve core for rush/review/mistakes.
3. **`ThemeTile`** (`apps/web/src/components/puzzle/theme-tile.tsx`) — humanized
   name, puzzle count, accuracy% (hidden if 0 attempts) on the S01 `.acc-*` scale,
   optional "Weakest" badge. Exports `humanizeTheme` + `accuracyBand` helpers.
4. **`TrainingSession`** (`apps/web/src/components/puzzle/training-session.tsx`) —
   the reusable active-drill shell.
5. **`/puzzles/train`** server page + `train-client.tsx` — theme selection
   (weakest surfaced first) → drill; `?theme=` deep-link; signed-out read-only.
6. **Tests** — `test/hooks/use-local-puzzle.test.ts` (6) + `test/puzzle/training-session.test.tsx` (4).
7. **OpenWolf** — cerebrum (solve-hook generalization, reusable shell), anatomy, memory.

## 1. Quality gates — all PASS

| Gate | Command | Final output line |
|---|---|---|
| Web tsc | `cd apps/web && pnpm exec tsc --noEmit` | exit 0 (clean) |
| Web tests | `cd apps/web && pnpm exec vitest run test/` | `Test Files  73 passed (73)` / `Tests  578 passed (578)` |

**Daily-puzzle non-regression confirmed:** after the puzzle-utils refactor,
`test/hooks/use-puzzle.test.ts (6)` and `test/board/puzzle-utils.test.ts (10)`
both still pass. New suites: `test/hooks/use-local-puzzle.test.ts (6)`,
`test/puzzle/training-session.test.tsx (4)`. Web tests went from 562 → **578**
(the 16 new cases).

## 2. Reusable contracts for S05 (rush) / S06 (review) / S07 (mistakes)

### `TrainingSession` prop contract (reuse verbatim)

```ts
import { TrainingSession } from '@/components/puzzle/training-session';

interface TrainingSessionProps {
  theme: string | null;          // theme slug to drill, or null for an unfiltered stream
  source: PuzzleSource;          // tags every recordAttempt server-side
  target?: number;               // solves to complete the session (default 10)
  onBack?: () => void;           // return to the caller's selection screen
  onChangeTheme?: () => void;    // "Change theme" in the summary (falls back to onBack)
}
```

Behavior the modes inherit, unchanged:
- Loop: `fetchNextPuzzle({theme})` → render `<Chessboard>` via `useLocalPuzzle`
  → on solve/fail POST `recordAttempt(id, { solved, msToSolve, source })` →
  surface puzzle rating + server `ratingDelta` → 1.2 s auto-advance.
- Header `solved N / attempted M` + a progress bar toward `target`.
- Session summary at `target` solves: solved/attempted, session accuracy, and
  theme accuracy **before** (stats fetched at mount) **vs now** (stats re-fetched
  at completion). Buttons: Train more / Change theme / Back.
- **Server-authoritative:** it only reports outcomes; it never sets a rating.

To build rush/review/mistakes, render `<TrainingSession source="rush"|"review"|"mistake" />`.
If a mode needs a different puzzle source than `fetchNextPuzzle({theme})` (e.g.
the review queue or a mistake list), the cleanest extension is to add an optional
`fetchPuzzle?: () => Promise<PuzzleDto | null>` prop and call it instead of
`fetchNextPuzzle` — note this as a small additive change when you get there
(current shell hard-codes `fetchNextPuzzle`).

### `useLocalPuzzle` signature (return shape)

```ts
import { useLocalPuzzle } from '@/hooks/use-local-puzzle';

useLocalPuzzle({
  puzzle: PuzzleDto | null,
  onSolved?: (info: { msToSolve: number }) => void,  // fires once
  onFailed?: () => void,                              // fires once
}): {
  state: {
    phase: 'idle' | 'player' | 'auto-reply' | 'success' | 'fail' | 'reveal';
    fen: string;
    solvingColor: 'w' | 'b';          // from the FEN active-color field
    lastMove: [string, string] | null;
    moveIndex: number;                // index into puzzle.moves of the next expected move
  };
  onMove: (uci: string) => void;      // submit the solver's move ("e2e4", "e7e8q")
  onReveal: () => void;               // from `fail`, step the rest of the solution
}
```

**Key convention difference vs the daily hook (do not mix them up):**

| | daily `use-puzzle` | local `use-local-puzzle` |
|---|---|---|
| start position | replayed from `game.pgn` to `initialPly` | `puzzle.fen` IS the start |
| `moves[0]` / `solution[0]` | opponent **setup** move (solver plays from idx 1) | **solver's** first move (idx 0) |
| setup phase | yes (animates the setup move) | **none** |
| solving color | FEN after setup | `puzzle.fen` active-color field |

Re-inits on `puzzle.id` change. Even `moveIndex` = solver move, odd = scripted
reply. `msToSolve` is measured from the first player move to the solve. Timers:
auto-reply 500 ms, reveal 800 ms.

## 3. `PuzzleSource` values + what moved into `puzzle-utils`

**`PuzzleSource`** (`@purechess/shared`, unchanged): `'theme' | 'daily' | 'rush' | 'review' | 'mistake'`.
- In play this session: **`'theme'`** (the trainer). The other four are reserved
  for the modes that consume `TrainingSession` later — pass the matching one.

**Moved into `puzzle-utils.ts` (the genuinely-shared solve logic):**
- `uciToIntent(uci): MoveIntent` — UCI string → board intent.
- `applyUci(fen, uci): { fen; lastMove } | null` — normalize rook-square castle,
  apply via `rules.applyMoveToFen`, return resulting FEN + king from/to. Used by
  both hooks for the player move, the auto-reply step, and the reveal step.
- `solvingColorFromFen(fen): 'w' | 'b'` — the FEN active-color field, white-default.

`uciMatch` + `normalizeCastleUci` were already in puzzle-utils (S-prior). The
move-matching + auto-reply/reveal **stepping** now run through these shared
helpers in both hooks; the daily hook's `setup`-phase logic stayed local to it.

## 4. Deviations + commit

**Deviations from the spec:** none material. Notes:
- The drill currently sources puzzles via `fetchNextPuzzle({theme})` only. Modes
  needing a different source (review queue, mistakes) should add an optional
  `fetchPuzzle` prop — flagged above as a tiny additive change, not done now
  because nothing this session needs it.
- `useLocalPuzzle` adds an `'idle'` phase (puzzle === null) absent from the spec's
  listed phases — it's the pre-load placeholder, never user-facing during a drill.
- `humanizeTheme` lives in `theme-tile.tsx` (and is imported by `TrainingSession`)
  rather than puzzle-utils, since it's display-layer not solve logic. The daily
  board's own `humanizeTheme` copy was left as-is to avoid touching that file.

**Inputs for dependent sessions:**
- **S05 (rush) / S06 (review) / S07 (mistakes):** import `TrainingSession`
  (`@/components/puzzle/training-session`) and `useLocalPuzzle`
  (`@/hooks/use-local-puzzle`); contracts above. Render `<TrainingSession>` with
  the right `source`. Reuse `ThemeTile` + `humanizeTheme` + `accuracyBand` from
  `@/components/puzzle/theme-tile` for any theme UI.
- **S11/S12 (links into training):** deep-link `/puzzles/train?theme=<slug>` to
  jump a user straight into a drill (handled in `train-client.tsx`).

**Commit:** `3e3f6c4` on `epic/purechess-improve`.
