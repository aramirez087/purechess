# Purchess

Pure chess, nothing else. No puzzles, no lessons, no streams — just the game.

Purchess is a minimalist online chess platform: anonymous casual play, rated games with Glicko-2 rankings, friend invites, reconnect support, and game review with PGN export.

## Quickstart

```bash
pnpm install                          # install all workspace deps
cp .env.example .env                  # fill in DATABASE_URL, REDIS_URL, SESSION_SECRET
pnpm infra:up                         # start Postgres + Redis via Docker
pnpm db:migrate:deploy                # run Prisma migrations
pnpm dev                              # web :3000 + api :4000
```

## Screenshot

![Purchess board](docs/assets/board-placeholder.png)

*(Placeholder — replaced pre-launch)*

## Architecture

```
Browser (Next.js 14)  ←──REST/WS──►  NestJS 10 API (:4000)
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                         Postgres          Redis         Supabase
                          (Neon)                           Auth
```

→ [Full architecture + ADRs](docs/ARCHITECTURE.md)

## Key Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start web + api |
| `pnpm test` | Unit tests (all workspaces) |
| `pnpm e2e` | Playwright browser E2E |
| `pnpm smoke` | Performance smoke test |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check |
| `pnpm infra:up` | Start local Postgres + Redis |
| `pnpm db:migrate:deploy` | Apply Prisma migrations |

## Docs

- [Architecture & ADRs](docs/ARCHITECTURE.md)
- [Contributing guide](docs/CONTRIBUTING.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Product spec](docs/epics/purchess-mvp.md)
- [Ops runbook](infra/RUNBOOK.md)

## License

MIT
