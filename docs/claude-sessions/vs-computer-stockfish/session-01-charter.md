---
session: 1
title: "Charter — audit, architecture, scaffolding"
depends_on: []
touches:
  - apps/api/prisma/**
  - apps/api/src/computer-games/**
  - packages/shared/src/dto/computer-game.dto.ts
  - packages/shared/src/index.ts
  - docs/roadmap/vs-computer-stockfish/**
parallel_safe: false
produces:
  - apps/api/prisma/migrations/**
  - apps/api/src/computer-games/computer-games.module.ts
  - packages/shared/src/dto/computer-game.dto.ts
  - docs/roadmap/vs-computer-stockfish/session-01-handoff.md
model: "sonnet"
---

# Session 01: Charter — audit, architecture, scaffolding

Paste this into a new Claude Code session:

```md
## Mission

Audit the Purechess monorepo, design the "play vs Stockfish" feature, write the DB migration and shared DTO stubs that downstream sessions will fill in, and document all decisions in a handoff.

## Repository anchors

- `apps/api/prisma/schema.prisma` — Prisma schema to extend
- `apps/api/src/chess/engine.service.ts` — existing engine service pattern to follow
- `apps/api/src/games/games.service.ts` — existing games module pattern
- `apps/api/src/app.module.ts` — root module where new module must be registered
- `packages/shared/src/dto/` — DTO convention; add `computer-game.dto.ts` here
- `packages/shared/src/index.ts` — re-export new DTO file here

## Tasks

1. Audit `apps/api/prisma/schema.prisma`. Add three nullable fields to the `Game` model:
   - `isVsComputer  Boolean  @default(false)`
   - `computerLevel Int?`     (1–8, maps to Stockfish UCI skill 0,3,5,8,11,14,17,20)
   - `computerColor String?`  ('white' | 'black')
   Generate migration: `cd apps/api && npx prisma migrate dev --name add_computer_game_fields`

2. Install the `stockfish` npm package in `apps/api`:
   `cd apps/api && npm install stockfish`
   Verify it resolves to the JS/WASM build (no system binary required).

3. Create `packages/shared/src/dto/computer-game.dto.ts` with these exported types:
   - `CreateComputerGameDto` — `{ level: 1|2|3|4|5|6|7|8, color: 'white'|'black'|'random', timeControlSeconds: number, incrementSeconds?: number }`
   - `ComputerMoveDto` — `{ move: string }` (the human's move in UCI notation, e.g. `e2e4`)
   - `ComputerGameStateDto` — `{ gameId: string, fen: string, pgn: string, status: string, lastComputerMove: string | null, result: string | null, resultReason: string | null }`
   Export from `packages/shared/src/index.ts`.

4. Create `apps/api/src/computer-games/` directory with stub files:
   - `computer-games.module.ts` — empty NestJS module (no imports yet)
   - `computer-games.service.ts` — empty `@Injectable()` class
   - `computer-games.controller.ts` — empty `@Controller('computer-games')` class
   - `stockfish.service.ts` — empty `@Injectable()` class with a comment: `// UCI bridge — filled in session 02`

5. Register `ComputerGamesModule` in `apps/api/src/app.module.ts`.

6. Build both packages to confirm zero TypeScript errors:
   `cd packages/shared && npm run build`
   `cd apps/api && npm run build`

## Deliverables

- `apps/api/prisma/migrations/<timestamp>_add_computer_game_fields/migration.sql`
- `packages/shared/src/dto/computer-game.dto.ts`
- `apps/api/src/computer-games/computer-games.module.ts`
- `apps/api/src/computer-games/computer-games.service.ts`
- `apps/api/src/computer-games/computer-games.controller.ts`
- `apps/api/src/computer-games/stockfish.service.ts`
- `docs/roadmap/vs-computer-stockfish/session-01-handoff.md`

## Quality gates

    cd packages/shared && npm run build
    cd apps/api && npm run build
    cd apps/api && npm run lint

## Exit criteria

- Migration SQL file exists and `prisma migrate dev` completes without error
- `packages/shared` builds with zero errors and exports `CreateComputerGameDto`, `ComputerMoveDto`, `ComputerGameStateDto`
- `apps/api` builds with zero TypeScript errors after adding the new module
- Handoff doc written to `docs/roadmap/vs-computer-stockfish/session-01-handoff.md`
```
