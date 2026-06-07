---
depends_on: [24]
touches:
  - "apps/web/e2e/**"
  - "apps/api/test/e2e/**"
  - "scripts/smoke.sh"
  - "docs/RELEASE_CHECKLIST.md"
  - "docs/ARCHITECTURE.md"
  - "docs/CONTRIBUTING.md"
  - "README.md"
  - "apps/web/README.md"
  - "apps/api/README.md"
parallel_safe: false
model: sonnet
cli: opencode
---

# Session 25: E2E Testing, QA & Documentation

## Mission

Ship the final quality gate: a comprehensive E2E test suite that proves the critical user flows work, a release checklist that exercises the PRD's acceptance criteria, and the architecture + contributing docs that let a new contributor (or future-you) understand the system.

## Tasks

1. **E2E test infrastructure** (`apps/web/e2e/`):
   - Playwright with two contexts (one per "user"). Tests can spawn two browsers and play against each other.
   - Use a dedicated test database and Redis namespace; `pnpm e2e:setup` resets state.
   - A test-only backend API endpoint (guarded by `NODE_ENV=test`) that creates users, sessions, and games directly to set up scenarios without going through OAuth.
2. **Critical-path E2E tests**:
   - **Anonymous casual game**: two anon users (created via test endpoint) find each other in the casual queue, play a full game, see a result.
   - **Authed rated game**: two seeded users Alice and Bob enter a rated blitz queue, get matched, play, see rating deltas.
   - **Friend invite**: Alice creates an invite link, Bob (in another browser context) opens and accepts, both play a casual game.
   - **Reconnect**: mid-game, kill Alice's socket, restart it, she re-joins and continues.
   - **Resign + draw + timeout**: each path ends the game with the correct result and reason.
   - **Game review**: open a completed game, step through moves, copy PGN, verify it parses.
   - **Profile + history**: open a profile, see ratings, click a recent game, see the review.
   - **Admin disable**: admin disables a user, that user's next request gets 401, audit log shows the action.
3. **API integration tests** (`apps/api/test/e2e/`):
   - Full HTTP/WebSocket integration for each module. The same scenarios as the Playwright suite, but at the protocol level — useful for CI without browser overhead.
4. **Performance smoke test**:
   - `scripts/smoke.sh`:
     - Hit `/` 100 times in parallel, assert 95th percentile < 1s.
     - Open 50 concurrent WebSocket connections, run a 60s tick, assert no errors.
     - Run a 10-minute burn-in of synthetic games (chess.js plays random legal moves on both sides) to surface memory leaks and clock drift.
5. **Release checklist** (`docs/RELEASE_CHECKLIST.md`):
   - One section per PRD release criterion:
     1. Users can register and log in. (E2E test + manual.)
     2. Anonymous users can play casual games. (E2E + manual.)
     3. Registered users can play rated games. (E2E + manual.)
     4. Matchmaking works for all supported time controls. (E2E parameterized over the 6 controls.)
     5. Game state is reliable. (Burn-in smoke test.)
     6. Clocks are accurate. (Unit test on engine; smoke test on the wire.)
     7. Reconnection works. (E2E.)
     8. Ratings update correctly. (Unit test on Glicko-2; E2E.)
     9. Completed games can be reviewed. (E2E.)
     10. PGN can be copied/exported. (E2E.)
     11. Admin can review reports. (E2E.)
     12. The board feels fast, clean, and stable on desktop and mobile. (Manual on iPhone + Android Chrome + Safari.)
   - Each item has a checkbox, a command or test to run, and an "owner".
   - The whole list must be checkable from a clean checkout in under 30 minutes.
6. **Architecture document** (`docs/ARCHITECTURE.md`):
   - System diagram (mirroring the EPIC.md ASCII).
   - Data flow for the three primary flows (anonymous casual, rated, friend invite).
   - State machine for `Game.status`.
   - WebSocket protocol summary.
   - Decision records (ADRs) for the major choices:
     - Why server-authoritative game state.
     - Why Socket.IO over raw WS.
     - Why Prisma + Postgres over MongoDB or hand-rolled SQL.
     - Why Glicko-2 over Elo.
     - Why shadcn/ui over a custom component kit.
7. **Contributing guide** (`docs/CONTRIBUTING.md`):
   - Setup from scratch.
   - How to run unit, integration, and E2E tests.
   - How to add a new module (backend) or page (frontend) with a checklist.
   - PR conventions: small, focused, with a corresponding session reference if relevant.
   - Code style: TypeScript everywhere, no comments, server-authoritative invariant, no theme/content scope creep.
8. **README refresh** (`README.md`):
   - One-paragraph positioning.
   - Quickstart (5 commands).
   - Screenshot of the board (placeholder OK for MVP, replaced pre-launch).
   - Architecture link.
   - License, contributing link.
9. **Per-app READMEs** (`apps/web/README.md`, `apps/api/README.md`):
   - Each app's purpose, run commands, key folders.
10. **Definition of Done** check:
    - Run all E2E tests on a clean checkout: green.
    - Run the smoke test: green.
    - Walk the release checklist: all items checked.
    - Open the app on a phone: board playable, fast.
    - Verify Lighthouse on the homepage: perf ≥ 95, a11y ≥ 95.
    - Verify the success metrics dashboard (PostHog) is recording the expected events.
11. **Verification**:
    - E2E suite runs in CI under 10 minutes.
    - Smoke test runs in CI under 5 minutes.
    - All docs render correctly (links resolve, code blocks are valid).
    - The release checklist is a living document — first version is shipped, owner maintains it.

## Deliverables

- Playwright E2E suite covering the critical paths.
- API integration test suite.
- Performance smoke test script.
- `docs/RELEASE_CHECKLIST.md`, `docs/ARCHITECTURE.md`, `docs/CONTRIBUTING.md`.
- Refreshed `README.md`s.

## Notes for Future Epics (post-MVP)

- The E2E suite is the foundation for safe iteration. Any new feature epic must add corresponding E2E coverage as part of its first session.
- The release checklist doubles as the launch readiness review. Update it as the system grows.
- Post-MVP features to plan in their own epics: full engine analysis, tournaments, clubs, lessons, puzzles, mobile apps, friends list.

## Definition of MVP Done

When the release checklist is fully green, the architecture doc matches the running code, and a fresh contributor can clone + run + deploy in under an hour, **Purchess MVP is done**.
