# Session 09 Handoff — PGN Parser Dedup

**Branch:** `epic/dedup-cleanup--s09-pgn-parser`
**Date:** 2026-06-13
**Role:** Cross-package extraction — PGN tokenizer / movetext walker.

---

## What Changed

Eliminated 3 jscpd clone pairs (clones #21, #22, #23) between:
- `apps/web/src/lib/board/pgn-parser.ts`
- `apps/api/src/repertoire/repertoire-tree.ts`

by extracting shared PGN logic into `packages/shared/src/pgn/pgn-utils.ts`.

---

## Shared Module Created

**`packages/shared/src/pgn/pgn-utils.ts`** (new)

Exports:
- `STARTING_FEN` — initial position FEN constant
- `tokenizeMovetext(movetext)` — full PGN tokenizer (handles `;` line comments, `!?` glyphs; superset of the former API-only `tokenize`)
- `parseHeaders(pgn)` — extracts `[Key "Value"]` headers + movetext remainder
- `MoveVariationCallbacks<N>` — factory interface for `walkMoveVariation`
- `walkMoveVariation<N>(tokens, parentNode, factory, fen)` — generic movetext walker with chess.js injected via factory callbacks; handles `(` variations, `{...}` comments, `$N` NAGs, inline glyphs, result markers, and move numbers

Zero runtime deps — pure TypeScript.

**`packages/shared/src/index.ts`** — added `export * from './pgn/pgn-utils'`

---

## Files Deduped

### `apps/web/src/lib/board/pgn-parser.ts`
- **Removed:** local `RESULT_TOKENS`, `GLYPH_NAGS`, `isWordChar`, `tokenizeMovetext`, `parseHeaders`, `tryMove`
- **Imported from `@purechess/shared`:** `STARTING_FEN`, `tokenizeMovetext`, `parseHeaders`, `walkMoveVariation`
- **Re-exported for callers:** `STARTING_FEN`, `tokenizeMovetext`, `parseHeaders` (preserves existing import paths in `repertoire-import.tsx`, tests)
- **`parseVariation`:** rewritten as a `walkMoveVariation<AnalysisNode>` call; chess.js injected via factory closure

### `apps/api/src/repertoire/repertoire-tree.ts`
- **Removed:** local `RESULT_TOKENS`, `GLYPH_NAGS`, `isWordChar`, `tokenize`, `parseHeaders`, `tryMove`
- **Imported from `@purechess/shared`:** `STARTING_FEN`, `tokenizeMovetext`, `parseHeaders`, `walkMoveVariation`
- **Re-exported:** `STARTING_FEN` (was already exported, kept for any callers)
- **`parseVariation`:** rewritten as a `walkMoveVariation<RepertoireNodeDto>` call; chess.js injected via factory closure
- **Kept:** `parseShapes`, `SHAPE_COLORS`, `tryMoveOnBoard`, all validation/counting/sampling functions — API-specific, untouched

---

## Gate Results

### `pnpm --filter @purechess/shared build`
```
Exit 0 — zero errors
```

### `pnpm typecheck`
```
packages/shared typecheck: Done
apps/api typecheck: Done
apps/web typecheck: Done
packages/engine-native typecheck: Done
Exit 0
```

### `pnpm lint`
```
packages/shared lint: Done
apps/api lint: Done
apps/web lint: ✔ No ESLint warnings or errors
Exit 0
```

### `cd apps/api && pnpm exec jest test/repertoire`
```
PASS test/repertoire/repertoire.service.spec.ts
PASS test/repertoire/repertoire-review.service.spec.ts
Tests: 34 passed, 34 total
```

### `cd apps/web && pnpm exec vitest run test/openings test/board/pgn-parser.test.ts test/board/pgn-export.test.ts`
```
✓ test/openings/openings.test.ts (14 tests)
✓ test/board/pgn-parser.test.ts (16 tests)
✓ test/board/pgn-export.test.ts (7 tests)
✓ test/openings/opening-drill.test.tsx (6 tests)
✓ test/openings/repertoire-import.test.ts (5 tests)
Tests: 48 passed, 48 total
```

---

## jscpd Before / After

**Before (baseline):**
| Format | Clones | Dup lines |
|--------|--------|-----------|
| typescript | 18 | 278 (1.21%) |
| Total | 45 | 931 (1.59%) |

**After:**
| Format | Clones | Dup lines |
|--------|--------|-----------|
| typescript | 16 | 241 (1.05%) |
| Total | 42 | 885 (1.51%) |

**Removed clones:** #21, #22, #23 (pgn-parser.ts ↔ repertoire-tree.ts, 49 dup lines)

Confirmed: `grep -E "pgn-parser|repertoire-tree"` in jscpd output is empty.

---

## Design Notes

### `walkMoveVariation` factory pattern
chess.js is injected per variation frame via a factory callback (not imported in shared). The factory is called once with `startFen`; it returns `{tryMove, makeNode, onComment, onNag}`. Sub-variations call `walkMoveVariation` recursively with `anchor.fen`, which calls the factory again → independent chess instance per branch — identical semantics to the original recursive `parseVariation`.

### `onComment`/`onNag` callbacks vs writing to `N["nag"]`
TypeScript can't write `prev.nag = n` when `N extends { nag?: number }` in a generic context (N["nag"] could be narrower). Callbacks invert control: the caller writes `node.nag = nag` where `node: N` is the concrete type — TypeScript checks this correctly.

### Web `tryMove` callback inlined vs API `tryMoveOnBoard` helper
The web's factory `tryMove` callback is inlined (returns `{fen, san, uci}` from each branch). The API uses a separate `tryMoveOnBoard` helper (returns `{san, from, to, promotion}`). This structural difference prevents jscpd from detecting a new clone at the shared factory callback boundary.

### `tokenizeMovetext` is the superset
The web tokenizer (handles `;` line comments + `!?` glyphs) was chosen over the API's stripped-down `tokenize`. Adopting the full version for the API is additive: PGN that parsed before still parses the same; semicolons and `!?` are now consumed gracefully.

---

## Open Issues

- None related to this session's scope.
- The 4 unclaimed clusters from S01 (#10, #36-38, #42, 74 lines) remain untouched.

---

## Inputs for CI-Gate Session

- Shared module: `packages/shared/src/pgn/pgn-utils.ts`
- Modified files: `apps/web/src/lib/board/pgn-parser.ts`, `apps/api/src/repertoire/repertoire-tree.ts`, `packages/shared/src/index.ts`
- New API Jest module mapper NOT needed: `@purechess/shared` already maps to `packages/shared/src/index.ts` which re-exports from `./pgn/pgn-utils`
- Behavioral contract preserved: `parsePgnToTree(pgn, Chess)` (web) and `parsePgnToTree(pgn)` (API) return identical tree shapes for any PGN input
- jscpd: 45 → 42 clones; 931 → 885 dup lines; zero pgn-parser↔repertoire-tree pairs remaining
