---
depends_on: [03, 09]
touches:
  - "apps/web/src/app/play/**"
  - "apps/web/src/app/play/page.tsx"
  - "apps/web/src/app/play/play-client.tsx"
  - "apps/web/src/components/play/**"
  - "apps/web/src/components/play/time-control-picker.tsx"
  - "apps/web/src/components/play/queue-status.tsx"
  - "apps/web/src/components/play/mode-selector.tsx"
  - "apps/web/src/components/play/cancel-button.tsx"
  - "apps/web/src/components/play/friend-link.tsx"
  - "apps/web/src/hooks/use-matchmaking.ts"
  - "apps/web/src/stores/matchmaking-store.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 13: Play Page & Matchmaking UI

## Mission

Build the entry point to playing chess on Purchess: a single page that lets a user pick a time control and game mode, enter matchmaking, see live queue state, and get routed into the game the moment a match is found.

This is the page that **earns or loses** the user's first 10 seconds.

## Tasks

1. **Routes**:
   - `apps/web/src/app/play/page.tsx` — server-rendered shell with metadata.
   - `apps/web/src/app/play/play-client.tsx` — client component (the interactive part).
2. **Modes** (`mode-selector.tsx`):
   - Three segmented options: **Casual**, **Rated**, **Play a friend**.
   - "Rated" is disabled (with tooltip) if the user is anonymous, with a "Log in to play rated" link.
   - "Play a friend" opens a sub-panel for invite-link generation (wired in Session 21; this session exposes the affordance).
3. **Time control picker** (`time-control-picker.tsx`):
   - Clean segmented buttons for the 6 supported controls (per PRD):
     - Bullet 1+0
     - Blitz 3+0 / 3+2 / 5+0
     - Rapid 10+0 / 15+10
   - Grouped under category headers.
   - Each control shows the total estimated time (e.g., "5+3 ≈ 8 min").
4. **Queue status** (`queue-status.tsx`):
   - Once a user joins the queue, the time-control picker collapses and a status panel appears:
     - Category + time control
     - Elapsed wait time (live, in seconds)
     - "Searching for opponent…" status
     - Cancel button (large, primary, calm)
   - Optimistic animation: subtle pulse on a single dot to indicate activity.
5. **Cancel button** (`cancel-button.tsx`):
   - Prominent. Confirms via a single click (no modal — it's a low-stakes action).
   - Returns the user to the picker.
6. **Friend link** (`friend-link.tsx`):
   - "Play a friend" flow:
     - User selects a time control.
     - Server creates an `invite_pending` game (per Session 21) and returns an invite token + URL.
     - UI shows the URL with a Copy button and a "Waiting for opponent…" state.
     - When the second player joins, both are routed to the game.
7. **Hook** (`use-matchmaking.ts`):
   - Manages WebSocket connection to `/realtime`.
   - Emits `matchmaking:join` on submit, `matchmaking:cancel` on cancel.
   - Listens for `matchmaking:state`, `matchmaking:found`, `matchmaking:error`.
   - Returns `{ state, join, cancel, error, match }`.
   - Auto-redirects to `/play/<gameId>` on `matchmaking:found`.
8. **Store** (`matchmaking-store.ts`):
   - Zustand store mirroring hook state for cross-component access (e.g., a header indicator if user is in queue).
   - Persists `lastSelectedControl` per category in localStorage for fast re-entry.
9. **Edge cases**:
   - User logged out mid-queue: emit cancel, redirect to login with a return URL.
   - User closes tab mid-queue: server times out the queue entry after 60s of no heartbeat.
   - Match found but socket disconnected before navigation: on next `/play` mount, check for active game via REST and resume.
10. **Empty / loading / error states**:
    - Picker disabled while connecting; spinner inline.
    - "No games available" — never shown, since matchmaking is asynchronous; if the queue is empty, just sit in the queue.
    - Network error → inline retry button.
11. **Performance**:
    - Picker is server-rendered when possible; interactive parts are tiny client islands.
    - First interaction (clicking "Play") to queue emit < 200ms.
12. **Tests**:
    - Component tests (Vitest + Testing Library): picker selection, mode toggling, cancel flow.
    - Hook test: simulates socket events and asserts state transitions.
    - Accessibility: keyboard reachable; focus visible; announcer for "match found" via `aria-live`.
13. **Verification**:
    - Lighthouse perf ≥ 90 on `/play`.
    - Manual: anonymous user can play casual; authed user can play rated; cancel returns to picker.

## Deliverables

- `/play` page usable from anonymous through rated.
- Reusable time-control picker and mode-selector components.
- `use-matchmaking` hook consumable by other pages.
- Friend-link UI wired to Session 21's API.

## Notes for Downstream Sessions

- Session 14 (active game page) lives at `/play/[gameId]` and reads the `gameId` from the URL. The matchmaking hook's redirect must use a Next.js `router.push` with a transition state so the game page can pick up the connection.
- The `/play` page is also where the user lands when redirected back from a disconnected active game (Session 14 reuses this page's hook for resume).
- The matchmaking store should **not** be the source of truth for active games — the active game page hydrates from REST and WebSocket directly. The store only knows about queue state.
- No "looking for casual game in 3+0" indicator that the user is at #1 in queue or similar — it would be misleading and we don't promise it.
