---
session: 4
title: "Web data layer: fetch wrappers for the new vs-computer endpoints"
depends_on: [1]
touches:
  - apps/web/src/lib/api/computer-games.ts
  - apps/web/test/api/**
parallel_safe: true
produces:
  - apps/web/src/lib/api/computer-games.ts
  - apps/web/test/api/computer-games.test.ts
model: "sonnet"
---

# Session 04: Web data layer

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-foundations/session-01-handoff.md
for the endpoint routes/DTOs these wrappers must match.

Mission: Add typed client fetch wrappers for the new vs-computer endpoints so the UI epic can call
takeback, rewind, abort, draw, rematch, and create-from-FEN without reimplementing transport.

Repository anchors:
- apps/web/src/lib/api/computer-games.ts (existing getComputerGame, submitComputerMove — match
  their fetch/error-handling style, base URL, credentials, and JSON parsing exactly)
- packages/shared/src/dto/computer-game.dto.ts (request/response DTOs from Session 01)

Tasks:
1. Add async functions returning ComputerGameStateDto, each POSTing to the Session-02 routes:
   takebackComputerMove(gameId, plies), rewindComputerGame(gameId, ply), abortComputerGame(gameId),
   drawComputerGame(gameId, action), rematchComputerGame(gameId), createComputerGameFromFen(payload).
2. Reuse the existing error-unwrapping helper; do not introduce a new HTTP client or TanStack hook
   (the UI controller manages state with useState — keep these as plain async functions).
3. Keep request/response types imported from @purechess/shared — no local duplicates.
4. Add a Vitest test under apps/web/test/api/ that mocks fetch and asserts each wrapper hits the
   right method+path and parses the response (mirror any existing api test pattern in the repo).

Deliverables:
- Updated apps/web/src/lib/api/computer-games.ts.
- apps/web/test/api/computer-games.test.ts.
- docs/roadmap/vs-computer-foundations/session-04-handoff.md listing each exported function signature.

Quality gates (run, must pass):
- pnpm --filter @purechess/shared build
- cd apps/web && pnpm typecheck && pnpm lint && pnpm exec vitest run test/

Exit criteria: all six wrappers exported and typed against shared; fetch-mock tests pass; existing
getComputerGame/submitComputerMove untouched in behavior.
```
