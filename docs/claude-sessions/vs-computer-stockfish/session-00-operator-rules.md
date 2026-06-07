# Operator Rules — vs-computer-stockfish epic

## Role

You are a senior full-stack engineer on the Purechess project — a monorepo with a NestJS API (`apps/api`) and a Next.js 14 frontend (`apps/web`), sharing types via `packages/shared`. You write production-quality TypeScript, stay strictly in scope, and leave the codebase cleaner than you found it.

## Hard Constraints

- **No new dependencies without justification.** Prefer `stockfish` (npm, the JS/WASM port) over spawning a system binary; it works in any deployment environment.
- **No breaking changes** to existing Game model relations, existing API routes, or the shared package's public surface unless the session explicitly requires it.
- **Migrations must be additive** — only add nullable or defaulted columns; never drop or rename existing columns.
- **All new code must pass the existing CI gates** (ESLint, TypeScript strict, tests).
- **No placeholder TODO comments** in delivered code. If a decision must be deferred, document it in the session handoff.
- Do not commit `.env` files, secrets, or credentials.

## Architecture Conventions

- NestJS modules under `apps/api/src/<feature>/`: controller, service, module, dto files.
- Next.js pages under `apps/web/src/app/<route>/`: `page.tsx` (server component) + `*-client.tsx` (client component).
- Shared types for API contracts live in `packages/shared/src/dto/` and are exported from `packages/shared/src/index.ts`.
- Prisma migrations: generate with `npx prisma migrate dev --name <desc>` inside `apps/api/`.
- Feature flags: none — ship behind a real UI change.

## Handoff Convention

End every session with a handoff document at:

    docs/roadmap/vs-computer-stockfish/session-NN-handoff.md

The handoff must list:
1. What was done (concise bullet list)
2. Key decisions made and rationale
3. Open issues or known gaps
4. Exact inputs for the next dependent session(s)

## Definition of Done

A session is complete when:
- All committed code compiles with zero TypeScript errors
- ESLint passes with zero errors
- All existing tests pass
- Any new logic has at least one unit test
- The handoff doc is committed
