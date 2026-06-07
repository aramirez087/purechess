# Session 02 Handoff — Database Schema & Prisma

## What Was Built

### Prisma Schema (`apps/api/prisma/schema.prisma`)
Full schema with `postgresqlExtensions` preview feature + citext extension. All models:
- `User` — citext username/email, nullable passwordHash, avatarUrl, admin/disabled flags
- `OAuthAccount` — composite unique on (provider, providerUserId)
- `Session` — userId + expiresAt indexes for fast lookup and TTL queries
- `PasswordResetToken` — tokenHash + usedAt for one-time use
- `Rating` — unique on (userId, category); Glicko-2 fields (ratingDeviation, volatility)
- `RatingHistory` — linked to gameId (nullable on game delete)
- `Game` — all PRD fields, inviteToken (unique nullable), full lifecycle via GameStatus
- `Move` — unique on (gameId, ply); Int for clockAfterMoveMs and moveTimeMs
- `Report` — three-way user relation (reporter, reported, reviewedBy), nullable gameId
- `FairPlaySignal` — Json payload, nullable gameId
- `AdminAuditLog` — Json payload

**Enums**: `GameResult`, `GameResultReason`, `GameStatus`, `TimeControlCategory`, `ReportStatus`, `OAuthProvider`, `FairPlaySignalType`

**Indexes**:
- `Game`: (whiteUserId, createdAt), (blackUserId, createdAt), (status, createdAt), (category, createdAt)
- `Move`: unique (gameId, ply)
- `Rating`: unique (userId, category)
- `Session`: (userId), (expiresAt)

### Migration
- Path: `apps/api/prisma/migrations/20260607035832_init/migration.sql`
- Applied successfully against local Postgres 16 (Docker)
- Includes `CREATE EXTENSION IF NOT EXISTS "citext"` first line

### NestJS Database Module
- `apps/api/src/database/prisma.service.ts` — extends PrismaClient, implements `OnModuleInit`/`OnModuleDestroy`
- `apps/api/src/database/database.module.ts` — `@Global()`, exports `PrismaService`
- `apps/api/src/app.module.ts` — imports `DatabaseModule` (controlled out-of-touches edit, necessary for module to function)

### Shared DB Enums (`packages/shared/src/db.ts`)
Pure TS string enums prefixed with `Db*` to avoid collision with existing shared enums:
`DbGameResult`, `DbGameResultReason`, `DbGameStatus`, `DbTimeControlCategory`, `DbReportStatus`, `DbOAuthProvider`, `DbFairPlaySignalType`
Re-exported from `packages/shared/src/index.ts` (controlled out-of-touches edit).

### Seed Script (`apps/api/prisma/seed.ts`)
- Admin: `admin@purchess.local` / `Admin1234!`, isAdmin=true
- Test users: `alice`, `bob`, `carol` all `Test1234!`, rating 1500 across all categories
- Game 1: Scholar's Mate (alice white wins, blitz 5+0, rated) — 7 moves + rating history
- Game 2: Ruy Lopez draw by agreement (bob vs carol, rapid 10+0, casual) — 10 moves
- Idempotent via `upsert`; seed command: `ts-node --project tsconfig.seed.json prisma/seed.ts`

### Config Changes
- `apps/api/package.json` — added `@prisma/client`, `prisma`, `bcryptjs`, `ts-node`, `@types/bcryptjs`; db scripts; `prisma.seed` entry
- `apps/api/tsconfig.seed.json` — ts-node tsconfig extending api tsconfig, rootDir `.`, includes `prisma/**/*`
- `pnpm-workspace.yaml` — approved build scripts for `@prisma/client`, `@prisma/engines`, `prisma`
- `.env.example` (root) — added `DATABASE_URL_DIRECT`

## Verification Evidence

```
pnpm --filter @purchess/api db:generate
→ ✔ Generated Prisma Client (v5.22.0) in 48ms

pnpm --filter @purchess/api db:migrate
→ Applying migration `20260607035832_init`
→ Your database is now in sync with your schema.

pnpm --filter @purchess/api db:seed
→ Seeded: admin, alice, bob, carol
→ 🌱  The seed command has been executed.

pnpm typecheck  → 0 errors (shared, api, web)
pnpm lint       → 0 errors (shared, api, web)
```

## Open Issues / Known Gaps

- `apps/api/.env` was created for migration (copied from root `.env`). It is gitignored. Downstream sessions running migrations locally need their own `apps/api/.env` or a `DATABASE_URL`/`DATABASE_URL_DIRECT` set.
- Docker Postgres 16 container (`purchess-postgres`) was used for migration. Production/CI should use Neon branch URL.
- `db:reset` uses `--force` — destructive in shared envs, only for local dev.
- `RatingHistory` has no unique constraint — duplicate records possible if seed is run twice without proper guard (currently uses `createMany` with `skipDuplicates`, so safe for re-seeding).
- Enum values in `packages/shared/src/db.ts` must be kept in sync with `schema.prisma` manually. If Prisma enums change, update `db.ts` and note in that session's handoff.

## Inputs Downstream Sessions Can Rely On

### Paths
- Schema: `apps/api/prisma/schema.prisma`
- Migration: `apps/api/prisma/migrations/20260607035832_init/migration.sql`
- PrismaService: `apps/api/src/database/prisma.service.ts`
- DatabaseModule: `apps/api/src/database/database.module.ts`

### Injecting PrismaService
```typescript
import { PrismaService } from '../database/prisma.service';
// DatabaseModule is @Global — no need to re-import DatabaseModule in feature modules
constructor(private readonly prisma: PrismaService) {}
```

### Exported Symbols
- From `@prisma/client`: all model types (`User`, `Game`, `Move`, etc.) and enum types (`GameStatus`, `TimeControlCategory`, etc.)
- From `@purchess/shared`: `DbGameResult`, `DbGameResultReason`, `DbGameStatus`, `DbTimeControlCategory`, `DbReportStatus`, `DbOAuthProvider`, `DbFairPlaySignalType`

### Seed Users (local dev)
| username | email | password | isAdmin |
|----------|-------|----------|---------|
| admin | admin@purchess.local | Admin1234! | true |
| alice | alice@purchess.local | Test1234! | false |
| bob | bob@purchess.local | Test1234! | false |
| carol | carol@purchess.local | Test1234! | false |

Seed games: `seed-game-1` (alice vs bob, blitz, rated, white wins), `seed-game-2` (bob vs carol, rapid, casual, draw)

### Env Keys
- `DATABASE_URL` — pooled connection (runtime PrismaClient)
- `DATABASE_URL_DIRECT` — direct connection (prisma migrate, prisma db push)

### DB Scripts (`pnpm --filter @purchess/api <script>`)
- `db:migrate` — `prisma migrate dev`
- `db:seed` — `prisma db seed`
- `db:reset` — `prisma migrate reset --force`
- `db:generate` — `prisma generate`
- `db:studio` — `prisma studio`
