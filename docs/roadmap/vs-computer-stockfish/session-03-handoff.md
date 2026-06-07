# Session 03 Handoff — Web Level Selector

## What Was Done

- Created `apps/web/src/lib/api/computer-games.ts`: client-side API helper with `createComputerGame(dto)` that POSTs to `/api/computer-games` and returns `ComputerGameStateDto`. Uses same `apiFetch` pattern as `reports.ts`.
- Created `apps/web/src/components/play/computer-game-setup.tsx`: full setup panel with:
  - Level picker: 8 buttons (1–8), selected state highlighted, label shown below (`Beginner` → `Master`)
  - Color picker: White / Black / Random toggle buttons (default: Random)
  - Time control picker: Bullet 1+0 / Blitz 3+2 / Rapid 10+0 toggle buttons (default: Blitz 3+2)
  - "Start Game" button — disabled + "Starting…" while pending
  - "Back" ghost button calls `onCancel`
  - Error message rendered on failure
  - On success: calls `onGameCreated(gameId)`
- Modified `apps/web/src/app/(play)/play/play-page-client.tsx`:
  - Extended `PlayMode` union to `'select' | 'friend' | 'computer'`
  - Added `useRouter` import and `const router = useRouter()` hook
  - Added `ComputerGameSetup` import
  - Added `computer` mode branch (renders `ComputerGameSetup` with cancel/navigate callbacks)
  - Replaced disabled "Quick Match" button with enabled button that captures `play_clicked { mode: 'computer' }` PostHog event and sets mode to `'computer'`

## Key Decisions

- **New `api/computer-games.ts` file, not modifying `api.ts`**: `api.ts` is server-only (uses `cookies()` from `next/headers`). Client components must not import it. Mirrors the `reports.ts` precedent.
- **Local `apiFetch` copy**: no shared client helper exists; DRY refactor out of scope. Acceptable duplication.
- **No React Query `useMutation`**: fire-and-forget single mutation with no cache invalidation needs. Local `useState` + async handler is simpler and consistent with session scope.
- **Import alias `@purchess/shared`**: confirmed by grepping existing imports across `apps/web/src`.
- **`router.push('/computer-game/' + gameId)` on success**: the route doesn't exist yet (Session 04). The navigation will 404 until Session 04 ships — documented below.

## Open Issues / Known Gaps

- **API endpoint not live**: Session 02 hasn't shipped the NestJS `POST /api/computer-games` endpoint. "Start Game" will get a network error until Session 02 is merged.
- **`/computer-game/[id]` route missing**: Session 04 must implement this page. Until then, successful game creation navigates to a 404.
- **Worktree lacks `node_modules`**: `tsc --noEmit` and `next lint` cannot run in this worktree. All observed TS errors (`Cannot find module 'react'`, `'next'`, `'@purchess/shared'`) are identical to pre-existing errors on other files and are environment-only. CI runs against the full repo with `node_modules` installed.

## Inputs for Session 04

Session 04 must implement `apps/web/src/app/computer-game/[id]/page.tsx` (and likely a `-client.tsx`).

- `onGameCreated` in `ComputerGameSetup` calls `router.push('/computer-game/' + gameId)`
- The page should fetch game state via `GET /api/computer-games/:id` and render the board
- `ComputerGameStateDto` shape (locked by Session 01):
  ```typescript
  { gameId, fen, pgn, status, lastComputerMove, result, resultReason }
  ```
- Player makes moves via `POST /api/computer-games/:id/move` with `{ move: string }` (UCI notation)
- Session 02 must be merged first so the API endpoints are live
