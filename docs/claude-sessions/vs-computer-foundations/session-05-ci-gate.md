---
session: 5
title: "CI gate: foundations green across api + web + shared"
depends_on: [2, 3, 4]
touches:
  - apps/api/**
  - apps/web/**
  - packages/shared/**
parallel_safe: false
skip_deliverables_check: true
model: "sonnet"
---

# Session 05: CI gate (foundations)

Paste this into a new Claude Code session:

```md
Continue from Session 02, 03, 04 artifacts. Read the handoffs under
docs/roadmap/vs-computer-foundations/ (session-02..04) to know what merged.

Mission: Prove the foundations epic is green end-to-end and produce a go/no-go report. Fix every
failure you find — type errors, lint errors, broken/uncovered tests, build breaks.

Repository anchors:
- packages/shared (must build first), apps/api (NestJS + Jest), apps/web (Next + Vitest)
- apps/api/package.json (engine coverage gate 90/90/85 on src/chess/engine/)

Tasks (run in order; iterate until all pass):
1. pnpm --filter @purechess/shared build
2. pnpm -r typecheck
3. pnpm -r lint
4. cd apps/api && pnpm test   (full Jest incl. engine coverage gate)
5. cd apps/web && pnpm exec vitest run test/   (scope to test/ — e2e specs pollute a bare vitest run)
6. pnpm build   (shared first, then apps)
7. Fix any failure at its source (do not delete or skip tests to make them pass). Re-run the full
   sequence after each fix until everything is green.

Deliverables:
- Any fixes required to make the above pass (committed).
- docs/roadmap/vs-computer-foundations/session-05-handoff.md: a go/no-go report listing each
  command, its final status, what was fixed, and confirmation the UI epic can build on this trunk.

Quality gates: the seven commands above, all passing.

Exit criteria: every command in Tasks exits 0; the handoff records a clear GO with the new endpoint
routes, engine API, and data-layer functions the UI epic will consume.
```
