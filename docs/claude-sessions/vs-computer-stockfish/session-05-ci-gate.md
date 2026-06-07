---
session: 5
title: "CI gate — full build, lint, type-check, tests"
depends_on: [4]
touches:
  - apps/api/**
  - apps/web/**
  - packages/shared/**
parallel_safe: false
skip_deliverables_check: false
produces:
  - docs/roadmap/vs-computer-stockfish/session-05-handoff.md
model: "sonnet"
---

# Session 05: CI gate — full build, lint, type-check, tests

Paste this into a new Claude Code session:

```md
## Continuity

Continue from Session 04 artifacts.
Read: `docs/roadmap/vs-computer-stockfish/session-04-handoff.md`

## Mission

Run the full CI suite across the monorepo, fix every failure, and produce a go/no-go report confirming the vs-computer-Stockfish feature is ready to merge.

## Repository anchors

- `apps/api/` — NestJS backend
- `apps/web/` — Next.js frontend
- `packages/shared/` — shared types

## Tasks

Run every command below in order. For each failure: read the error, trace to the root cause, fix it, then re-run that command before proceeding. Do not skip failures or mark them as "known issues."

1. Shared package:

       cd packages/shared && npm run build

2. API — build, lint, type-check, unit tests:

       cd apps/api && npm run build
       cd apps/api && npm run lint
       cd apps/api && npm test

3. Web — lint, type-check, build:

       cd apps/web && npm run lint
       cd apps/web && npx tsc --noEmit
       cd apps/web && npm run build

4. Verify the migration is coherent:

       cd apps/api && npx prisma validate

5. Smoke-check the new endpoints exist in the compiled API bundle (grep for route registrations in the dist or inspect NestJS metadata — no live server needed).

6. Write `docs/roadmap/vs-computer-stockfish/session-05-handoff.md` with:
   - Go / No-Go verdict
   - All commands run and their pass/fail status
   - Any fixes applied in this session (file, what changed, why)
   - Outstanding risks or follow-up items

## Deliverables

- `docs/roadmap/vs-computer-stockfish/session-05-handoff.md`
- Any files fixed to make CI pass

## Quality gates

All commands in Tasks 1–4 must exit 0.

## Exit criteria

- `packages/shared`, `apps/api`, `apps/web` all build with zero errors
- `npm test` in `apps/api` passes all tests including the new `computer-games` suite
- `npx prisma validate` exits 0
- Handoff doc states "Go" with every command listed as passing
```
