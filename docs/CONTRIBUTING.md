# Contributing to Purechess

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- Docker (for local Postgres + Redis)
- A Neon project (or local Postgres for dev)

## Setup from scratch

```bash
git clone <repo-url> purechess
cd purechess

# Install all workspace dependencies
pnpm install

# Copy env and fill in values
cp .env.example .env

# Start local Postgres + Redis
pnpm infra:up

# Run migrations
pnpm db:migrate:deploy

# Seed development data
pnpm --filter @purechess/api db:seed

# Start both apps (ports 3000 and 4000)
pnpm dev
```

## Running tests

### Unit tests

```bash
# All packages
pnpm test

# API only
pnpm --filter @purechess/api test

# Web only
pnpm --filter @purechess/web test
```

### API integration tests (E2E at the HTTP/WS level)

```bash
# Requires: local Postgres running, NODE_ENV=test set automatically
pnpm --filter @purechess/api test:e2e
```

### Playwright browser E2E

```bash
# 1. Ensure the stack is running with NODE_ENV=test
NODE_ENV=test pnpm dev

# 2. In another terminal, run the suite
pnpm e2e

# Run a single spec
pnpm --filter @purechess/web e2e -- --grep "anon-casual"
```

### Performance smoke test

```bash
# Requires: running stack at localhost:3000 and localhost:4000
bash scripts/smoke.sh
```

## Adding a new backend module

1. Create `apps/api/src/<name>/`:
   - `<name>.module.ts` — `@Module({ controllers, providers })`, registered in `AppModule`
   - `<name>.controller.ts` — REST endpoints, `@UseGuards(AuthGuard)` where needed
   - `<name>.service.ts` — business logic, inject `PrismaService` and dependencies
2. Register module in `apps/api/src/app.module.ts` imports array.
3. Add Prisma models/migrations if new DB tables are needed: `pnpm --filter @purechess/api db:migrate`.
4. Add unit tests in `apps/api/test/<name>/`.
5. Add integration test in `apps/api/test/e2e/<name>.e2e-spec.ts`.

### Module checklist

- [ ] Module file registers controller and service
- [ ] Controller uses `AuthGuard` / `AdminGuard` where applicable
- [ ] Service has no direct HTTP or WS imports — only `PrismaService`, Redis, other services
- [ ] DTOs defined with `class-validator` decorators
- [ ] Unit tests cover all non-trivial service methods
- [ ] Integration test covers happy path + auth boundary

## Adding a new frontend page

1. Create `apps/web/src/app/<route>/page.tsx` — server component by default.
2. Add client components under `apps/web/src/components/<feature>/`.
3. Server state via TanStack Query (`useQuery` / `useMutation`).
4. Client-only state via Zustand stores in `apps/web/src/stores/`.
5. Styles: Tailwind only, shadcn/ui components from `apps/web/src/components/ui/`.
6. Add a Playwright spec in `apps/web/e2e/tests/`.

### Page checklist

- [ ] Page is accessible (Radix primitives, keyboard navigation)
- [ ] No inline CSS — Tailwind classes only
- [ ] Loading and error states handled
- [ ] Playwright spec covers critical path

## PR conventions

- **Small and focused**: one feature or fix per PR. A PR that touches 10 modules is hard to review.
- **Reference the session**: if work corresponds to a planned session, note it (e.g. `s12: add invite flow`).
- **Commits**: `sNN: <imperative summary>` for session work; `fix: <summary>` / `feat: <summary>` for ad-hoc work.
- **No TODOs in code**: resolve or document in the PR description.
- **Tests required**: non-trivial logic must have unit tests; new user-facing flows must have E2E coverage.

## Code style

- **TypeScript everywhere**: no `.js` in `src/` or `app/` directories.
- **No inline comments**: let the code speak. JSDoc on exported functions is allowed.
- **Server-authoritative invariant**: never trust client-submitted board positions or clock readings.
- **No scope creep**: features marked out of scope in the PRD (puzzles, lessons, tournaments, video, clubs, forums, bots, native apps) stay out.
- **Prisma for all DB access**: no raw SQL except explicitly reviewed `$queryRaw` calls.
- **Zustand for client state, TanStack Query for server state**: no Redux, no SWR.
