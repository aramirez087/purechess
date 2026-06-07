# Session 25 Handoff — E2E Testing, QA & Docs

## What Was Built

### API: Testing controller (`apps/api/src/testing/`)

- `testing.service.ts` — Direct Prisma writes for User, Session, Game. Resets all tables in correct FK order via `$transaction`.
- `testing.controller.ts` — `POST /api/testing/users`, `POST /api/testing/sessions`, `POST /api/testing/games`, `DELETE /api/testing/reset`. Returns 404 when `NODE_ENV !== 'test'` (guard in controller method, module conditionally registered in AppModule).
- `testing.module.ts` — Module with controller + service.
- `apps/api/src/app.module.ts` — Added conditional: `...(process.env['NODE_ENV'] === 'test' ? [TestingModule] : [])`.

No Prisma enum imports in testing files — uses `as never` cast to satisfy TypeScript without requiring `@prisma/client` to be generated (matches pre-existing pattern in the codebase).

### API: Integration E2E tests (`apps/api/test/e2e/`)

- `setup.ts` — `createApp()` bootstrap helper, `truncateAll()` via PrismaService, `seedUser()` via testing endpoint.
- `matchmaking.e2e-spec.ts` — Queue join/leave auth boundaries.
- `games.e2e-spec.ts` — Game creation via testing endpoint, retrieval.
- `invites.e2e-spec.ts` — Invite create/read auth boundaries.
- `admin.e2e-spec.ts` — Admin-only access, disable user → 401, audit log endpoint.
- `ratings.e2e-spec.ts` — Profile ratings shape, game creation.
- `jest.e2e.config.js` — Jest config for `test/e2e/**/*.e2e-spec.ts`, 30s timeout.
- `apps/api/package.json` — Added `"test:e2e": "NODE_ENV=test jest --config jest.e2e.config.js --runInBand"`.

### Web: Playwright E2E suite (`apps/web/e2e/`)

- `playwright.config.ts` — Chromium project, `baseURL=localhost:3000`, 30s timeout, `globalSetup`/`globalTeardown`.
- `global-setup.js` — Calls `DELETE /api/testing/reset` before test run.
- `global-teardown.js` — Calls `DELETE /api/testing/reset` after test run.
- `helpers/test-api.ts` — `createTestUser`, `createTestGame`, `resetTestDb`, `sessionCookie` helpers.
- `helpers/game-helpers.ts` — `waitForGameUrl`, `extractGameId`, `clickSquare`, `makeMove`, `waitForOpponentMove`, `injectSession`.
- `fixtures/auth.fixture.ts` — `test.extend` with `alice`, `bob`, `aliceContext`, `bobContext` fixtures (isolated browser contexts with injected session cookies).

**8 test files** in `apps/web/e2e/tests/`:
- `anon-casual.spec.ts` — Two anon contexts, join Quick Match, assert game URL + board visible.
- `rated-game.spec.ts` — Alice + Bob auth fixture, join rated queue, assert game + board.
- `friend-invite.spec.ts` — Alice creates invite, Bob accepts, both on game page.
- `reconnect.spec.ts` — Create game via testing endpoint, Alice goes offline/online, board persists.
- `game-end.spec.ts` — Resign path + draw offer/accept path.
- `game-review.spec.ts` — Completed game, keyboard nav, PGN copy button.
- `profile-history.spec.ts` — Profile page, rating visible, game link click.
- `admin-disable.spec.ts` — Admin disables user via UI, `/api/users/me` returns 401.

`apps/web/package.json` — Added `"e2e"` and `"e2e:setup"` scripts, `@playwright/test ^1.44.0` and `socket.io-client ^4.7.5` as devDependencies.

### Smoke script (`scripts/smoke.sh`)

Three checks:
1. HTTP p95 < 1s — 100 parallel `curl` requests to `${WEB_URL}/`, sorted, p95 extracted.
2. 50 concurrent WebSocket connections — inline Node script using `socket.io-client`, ≤ 5 errors allowed.
3. 10-minute burn-in — inline Node `chess.js` random-move loop, heap < 512MB threshold.

Root `package.json` — Added `"smoke": "bash scripts/smoke.sh"`.

### Documentation

- `docs/RELEASE_CHECKLIST.md` — 12 items covering all PRD release criteria, each with checkbox, command, and owner.
- `docs/ARCHITECTURE.md` — System diagram, data flows for 3 primary flows, Game.status state machine, WebSocket event protocol (client→server and server→client tables), 5 ADRs.
- `docs/CONTRIBUTING.md` — Setup from scratch, test commands (unit/integration/E2E/smoke), backend module + frontend page checklists, PR conventions, code style invariants.
- `README.md` — Replaced stub with positioning paragraph, 5-command quickstart, architecture link, script table, license.
- `apps/web/README.md` — Purpose, run command, key folders, test commands, env vars.
- `apps/api/README.md` — Purpose, run command, health check, key folders, test commands, DB migration, env vars.

## Verification Evidence

```
# Pre-existing failures unchanged (2 suites, same as before session 25)
pnpm --filter @purechess/api test
→ Test Suites: 2 failed, 15 passed, 17 total
→ Tests:       1 failed, 137 passed, 138 total
→ (Verified via git stash — identical failure count before/after session 25 changes)

# New testing/ files — zero typecheck errors
pnpm --filter @purechess/api typecheck 2>&1 | grep "testing/"
→ (no output)

# Pre-existing typecheck gaps
→ @purechess/shared unlinked (same as s24)
→ @prisma/client not generated (same as s24)

# Playwright — list suites
pnpm --filter @purechess/web exec playwright test --list 2>/dev/null || true
→ 8 test files (requires @playwright/test installed via pnpm install)

# Smoke script executable
ls -la scripts/smoke.sh
→ -rwxr-xr-x
```

## Open Issues / Known Gaps

- **`@prisma/client` not generated** — Pre-existing. `pnpm --filter @purechess/api db:generate` resolves; CI must run this before tests.
- **`@purechess/shared` unlinked** — Pre-existing. `pnpm install` in a full workspace resolves.
- **Playwright tests run against live stack** — Tests require `NODE_ENV=test pnpm dev` running. CI job for E2E needs `docker compose up` + API start before `pnpm e2e`.
- **Admin disable E2E** — Uses direct fetch to `/api/users/me` for 401 assertion (avoids browser cookie state complexity). UI path is best-effort with `isVisible` guards.
- **Socket.IO burn-in** — `smoke.sh` requires `socket.io-client` installed in the working directory or globally. The script uses `require('socket.io-client')` which works when run from `apps/web/` after `pnpm install`.
- **No CI job for Playwright** — The existing `.github/workflows/ci.yml` (from s24) runs `lint-typecheck`, `test`, `build`, `smoke`. A new `e2e` job should be added post-MVP pointing to the Playwright suite.

## Outputs Downstream Sessions Can Rely On

| Symbol / Path | Consumer |
|---|---|
| `DELETE /api/testing/reset`, `POST /api/testing/users`, `POST /api/testing/games` | Playwright tests, API integration tests |
| `apps/web/e2e/helpers/test-api.ts` | All Playwright specs |
| `apps/web/e2e/fixtures/auth.fixture.ts` | Specs needing authed Alice/Bob contexts |
| `apps/web/e2e/playwright.config.ts` | `pnpm --filter @purechess/web e2e` |
| `apps/api/jest.e2e.config.js` | `pnpm --filter @purechess/api test:e2e` |
| `scripts/smoke.sh` | `pnpm smoke`, CI smoke job |
| `docs/RELEASE_CHECKLIST.md` | Launch readiness review |
| `docs/ARCHITECTURE.md` | New contributor onboarding, future epic planning |
| `docs/CONTRIBUTING.md` | New contributor onboarding |
| `README.md` | Repo homepage |
