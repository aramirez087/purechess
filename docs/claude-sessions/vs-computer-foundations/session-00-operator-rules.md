# Session 00 — Operator Rules (vs-computer-foundations)

These rules apply to **every** session in this epic. Read them first, every time. Each
session is a fresh Claude Code process with **zero memory** of prior sessions — all
continuity flows through files referenced by path.

## Role

You are a senior full-stack engineer on **PureChess**, a pnpm/ESM monorepo (Next.js 14
web + NestJS 10 api + `@purechess/shared`). This epic builds the **server + engine + data
capabilities** that the vs-computer UI epic will consume. You write correct, tested,
production code — not prototypes.

## Project ground truth (do not relearn the hard way)

- **OpenWolf protocol.** Before reading a file, check `.wolf/anatomy.md`. Before writing
  code, read `.wolf/cerebrum.md` (esp. `## Do-Not-Repeat`) and `.wolf/buglog.json`. After
  significant actions, append a line to `.wolf/memory.md`; after creating/renaming files,
  update `.wolf/anatomy.md`; after fixing any bug/error, append to `.wolf/buglog.json`.
- **Computer games run Stockfish CLIENT-SIDE.** The browser computes both the human and
  the bot move and POSTs each as `{move:"uci"}`; the API **validates + persists only and
  runs NO engine**. Never add a server-side engine. (`.wolf/cerebrum.md` Key Learnings.)
- **`Move` rows have a UNIQUE `(gameId, ply)` constraint.** Undo/rewind must delete rows,
  not collide on re-insert.
- **bug-005:** `applyMove` (chess/engine/game-state.ts) can return WITHOUT appending a move
  on a flag-fall/timeout early-return. Always check `state.moves.length` grew before writing
  a `Move` row.
- **ESM + shared:** `packages/shared` uses explicit `.js` extensions in relative imports.
  `@purechess/shared` **must be built before web/api typecheck/build** (`pnpm --filter
  @purechess/shared build`). API Jest maps the import to `src/index.ts` directly.
- **WS event names** come only from the `WsEvent` enum in `packages/shared/src/ws-events.ts`
  — never raw strings.
- A DB column `engineStateSnapshot` for vs-computer games already exists (migration
  `20260607140000_computer_game_engine_state`) — reuse it for rewind/undo state.

## Hard constraints

- TypeScript everywhere. Respect Prettier + ESLint flat config (root `eslint.config.js`).
- DTOs/types shared between web and api live in `packages/shared` — never duplicate them.
- The chess engine dir `apps/api/src/chess/engine/` has an enforced Jest coverage gate
  (90% lines/functions, 85% branches). Keep new branches covered.
- Server is authoritative for legality — never trust the client for move validity.
- Add a Prisma **migration** for any schema change (`pnpm --filter @purechess/api db:migrate`);
  never edit applied migration SQL.
- No secrets in code. No `TODO`/`FIXME` left behind.

## Handoff convention

**End every session by writing a handoff under `docs/roadmap/vs-computer-foundations/`**
named `session-NN-handoff.md`. It must record: what was done, decisions + rationale, open
issues/risks, exact file paths produced, and **explicit inputs the next session needs**
(new endpoint signatures, DTO shapes, function names). Downstream sessions read this file —
never assume memory.

## Definition of done (every session)

1. `pnpm --filter @purechess/shared build` succeeds.
2. Code typechecks (`pnpm -r typecheck`) and lints (`pnpm -r lint`) clean.
3. Tests pass for the scope you touched (api: `cd apps/api && pnpm test`; web unit:
   `cd apps/web && pnpm exec vitest run test/`).
4. New behavior has tests; the engine-coverage gate still passes.
5. Decisions documented and a handoff written under `docs/roadmap/vs-computer-foundations/`.
