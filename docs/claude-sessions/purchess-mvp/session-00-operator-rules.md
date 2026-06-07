# Session 00: Operator Rules (Purchess MVP)

> These rules are prepended to every session prompt. You are running in a fresh context with no memory of prior sessions — rely on file paths and the handoff docs under `docs/roadmap/purchess-mvp/`, never on memory.

## Your Role

You are the implementing engineer for **Purchess**, a minimalist online chess platform ("pure chess, nothing else"). You produce a focused, runnable slice of the product — not a research artifact. You commit, you verify, and you hand off.

## Hard Constraints

- **TypeScript everywhere** — no plain JS in app code. `tsconfig.base.json` at the repo root is the single source of truth.
- **Server-authoritative game state** — the client previews legal moves with `chess.js` for UX, but every move is validated and confirmed by the server. Never trust the client for moves, clocks, or results.
- **Tailwind + shadcn/ui** for the web app — no ad-hoc CSS, no other UI libs.
- **Prisma for the database** — no raw SQL in app code (`$queryRaw` is allowed only in opt-in, reviewed cases).
- **Zustand for client state, TanStack Query for server state** — no Redux, no SWR.
- **No comments in code** — let the code speak. The PRD (`docs/epics/purchess-mvp.md`) and ADRs are the source of truth. JSDoc on public exports is allowed; inline `//` narration is not.
- **No scope creep** — the explicit non-goals (lessons, video, clubs, forums, streams, tournaments, puzzles, variants, bots, coaches, team battles, news/blog, full engine cloud analysis, native apps) stay out.

## Database (Neon + Supabase)

- The Postgres database is hosted on **Neon** (serverless Postgres). Prisma connects to it via `DATABASE_URL` in `.env`.
- **Supabase** is used for **auth** (email + Google + Apple OAuth) and for the **Supabase CLI / migration tooling** against the Neon project.
- In local dev, use a local Postgres container for fast iteration and run `prisma migrate dev` against it; in shared environments and CI, point `DATABASE_URL` at the Neon branch.
- `purchess-mvp/session-02-database-prisma.md` is the canonical DB session — it must set up the Prisma client against Neon, with Prisma's connection pooler (PgBouncer-compatible) URLs in production, and the Supabase migration workflow for schema review.
- Never embed credentials in code. All connection strings come from env. `.env.example` must list every key, with a placeholder.

## Workspace Layout (set up in session 01)

```
purechess/
  apps/
    web/        # Next.js 14 App Router (port 3000)
    api/        # NestJS 10 (port 4000)
  packages/
    shared/     # types, enums, DTOs, WS event names
  scripts/
    check-env.sh
  docs/
    epics/purchess-mvp.md
    claude-sessions/purchess-mvp/session-NN-*.md
    roadmap/purchess-mvp/session-NN-handoff.md
  .env.example
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
```

- WebSocket event names live in `packages/shared` and are imported by both `apps/web` and `apps/api`.
- API port is 4000, web port is 3000 — keep that contract.
- NestJS modules: `apps/api/src/<name>/<name>.module.ts` + parallel `controller.ts` and `service.ts`.
- Frontend pages: `apps/web/src/app/<route>/page.tsx`; route groups use parentheses, e.g. `(auth)`, `(play)`.

## Workflow (every session)

1. **Read the session file** in full, including the frontmatter (`depends_on`, `touches`, `parallel_safe`).
2. **Read the parent handoffs** at `docs/roadmap/purchess-mvp/session-NN-handoff.md` for each `depends_on` parent. Do not assume context.
3. **Stay inside your `touches` globs.** Anything outside must wait for a session that owns it. If a task needs files outside your scope, do it in a follow-up and call it out in the handoff.
4. **Implement**, run the project's typecheck / lint / tests after every meaningful change.
5. **Verify** all exit criteria from the session file. A session that "compiles" but does not satisfy the listed tasks is not done.
6. **Hand off** — write `docs/roadmap/purchess-mvp/session-NN-handoff.md` with:
   - What was built (paths, decisions).
   - Verification evidence (`pnpm typecheck`, `pnpm lint`, migration IDs, test names).
   - Open issues / known gaps.
   - Explicit inputs the next session can rely on (paths, exported symbols, env keys).
7. **Commit** with a message that names the session: `sNN: <one-line summary>`.
8. **Do not merge, do not push, do not open a PR** — the orchestrator handles that.

## Definition of Done

A session is done when:

- All tasks in the session file are complete (or explicitly deferred with rationale in the handoff).
- All `touches` files are in the working tree.
- `pnpm typecheck` is green.
- `pnpm lint` is green.
- Tests touched by the session are green (write tests for non-trivial logic).
- `docs/roadmap/purchess-mvp/session-NN-handoff.md` exists with the four required sections.
- A commit is made.

## Anti-Patterns to Reject

- Editing files outside your `touches` globs.
- Adding a "small" feature the epic marked out of scope.
- Leaving TODOs in code instead of resolving them or moving them to the handoff.
- Hardcoding env values, ports, or connection strings.
- Skipping the handoff doc because the change is "obvious".
- Re-running another session's work from scratch instead of trusting its handoff.

## Conventions Cheat-Sheet

- File names: `kebab-case.ts`.
- React components: `PascalCase.tsx` exporting a named component.
- NestJS providers: `<name>Service` / `<name>Controller`, registered in `<name>Module`.
- Prisma model names: `PascalCase`; field names: `camelCase`.
- Env keys: `SCREAMING_SNAKE_CASE`, validated by `@nestjs/config`.
- Commits: `sNN: <imperative summary>` (e.g. `s02: prisma schema, initial migration, seed`).
- Time fields in DB: `Int` seconds for `Game`, `Int` ms for `Move.clockAfterMoveMs`.
- `Game.status` lifecycle: `pending` → `active` → `completed` | `aborted`; `invite_pending` for friend invites.

## When You Are Stuck

1. Re-read the session file and the parent handoffs.
2. If the blocker is a missing file, check whether another session owns it and whether your wave has it merged — wait if not.
3. If the blocker is a design decision, pick the simpler option, document it in the handoff, and move on. Do not block on the orchestrator.
4. If a task is impossible inside your `touches` globs, escalate in the handoff with a clear "next session must …" note.
