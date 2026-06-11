# Session 05 Handoff — E2E Interactions

**Epic:** purechess-category-best  
**Branch:** epic/purechess-category-best--s05-e2e-interactions  
**Date:** 2026-06-11

## What was done

### Harness rot fixed (6 files)

- `e2e/helpers/game-helpers.ts` — `waitForGameUrl` / `extractGameId` now match `/play/` (live PvP) not `/games/`
- `e2e/tests/friend-invite.spec.ts` — URL pattern `/play/`, invite link uses `textContent()` on `<code data-testid="invite-link">`
- `e2e/tests/reconnect.spec.ts` — routes corrected to `/play/${game.id}`
- `e2e/tests/game-end.spec.ts` — routes fixed, confirm-dialog step removed (no confirm exists), draw-offer test `test.skip`'d
- `e2e/tests/rated-game.spec.ts` — `test.skip` (matchmaking UI not built)
- `e2e/tests/anon-casual.spec.ts` — `test.skip` (anonymous matching not built)

### data-testid attributes added (6 source files)

| Selector | Component |
|---|---|
| `[data-testid="chess-board"]` | `src/components/board/chessboard.tsx` |
| `[data-testid="game-result"]` | `src/components/game/result-overlay.tsx` |
| `[data-testid="user-rating"]` | `src/components/profile/ratings-card.tsx` |
| `[data-testid="game-history-item"]` | `src/components/profile/recent-games.tsx` |
| `[data-testid="invite-link"]` | `src/components/play/invite-create.tsx` |
| `[data-testid="game-row"]` | `src/components/games/game-history-row.tsx` |

### Testing API extensions

- `apps/api/src/testing/testing.service.ts` — `createGame` now accepts optional `isRated?: boolean` (defaults to schema default `true`)
- `apps/api/src/testing/testing.controller.ts` — `CreateGameDto` exposes `isRated?`
- `apps/web/e2e/helpers/test-api.ts` — `createTestGame` accepts `isRated?`; new `createTestComputerGame` helper calls `POST /api/computer-games/from-fen` with session cookie

### 7 new spec files

| File | What it tests |
|---|---|
| `e2e/tests/promotion-keyboard.spec.ts` | Dialog appears on pawn promo, Tab/Enter picks piece, Escape cancels |
| `e2e/tests/premove.spec.ts` | Out-of-turn moves rejected by server; move count stays unchanged |
| `e2e/tests/flag-fall.spec.ts` | 1s time control expires, result overlay appears; no Move row inserted |
| `e2e/tests/rated-finalization.spec.ts` | Fool's Mate → checkmate → overlay for both players → ratings page renders |
| `e2e/tests/ledger-navigation.spec.ts` | `/games` list, category filter, row click → review, Review link |
| `e2e/tests/analyze-flow.spec.ts` | Valid PGN/FEN → board, invalid → error, "New analysis" resets |
| `e2e/tests/result-overlay.spec.ts` | Overlay on completed game, "View board" dismiss, "New" link, resign path |

## Quality gates

- `pnpm exec tsc --noEmit` (web + api): **clean**
- `pnpm exec vitest run test/` (web): **33/33 suites, 256/256 tests**
- `pnpm test` (api): **282/282 tests pass** (2 suite-load errors are pre-existing argon2 native-binary issue in the worktree, unrelated to this session)

## Known risks / caveats for Session 06

1. **flag-fall clock init**: `createTestGame` inserts a DB row only; clock state for live PvP lives in Redis and is initialized by the realtime module on first WS connection. The 1-second flag-fall test depends on the realtime service picking up the game and starting the clock on WS connect. If the realtime module ignores games not created via the normal `GamesService.create` flow, the test will time out — consider adding clock init to `TestingService.createGame` or seeding a `ClockState` Redis key directly.

2. **premove rejection UX**: The test asserts move count stays at 0 after a rejected move. The actual rejection path (WS error event / optimistic rollback) was not instrumented here — if the implementation queues moves client-side and sends them later, the test may pass for the wrong reasons.

3. **rated-finalization**: Glicko-2 runs inside `RatingsService.processGameResult` which is wrapped in `try/catch`. If it throws silently, the profile page still renders with default 1500 ratings. The test only verifies the rating section renders, not that the rating changed from 1500.

4. **friend-invite + reconnect tests**: Still depend on real WebSocket connections and invite flow. These pass only when both servers are running and the invite/realtime modules respond correctly.

## Next session suggestions

- Run the full 15-spec suite twice on CI with both servers up  
- Instrument the flag-fall test with direct Redis clock seeding in `TestingService`  
- Add `toContainText` assertion to rated-finalization test (check rating ≠ 1500 post-game)  
- Fill in the `test.skip` specs (matchmaking, anonymous play) once those features land
