---
session: 3
title: "Web — level selector UI + play page wiring"
depends_on: [1]
touches:
  - apps/web/src/app/(play)/play/**
  - apps/web/src/components/play/**
parallel_safe: true
produces:
  - apps/web/src/components/play/computer-game-setup.tsx
  - apps/web/src/app/(play)/play/play-page-client.tsx
  - docs/roadmap/vs-computer-stockfish/session-03-handoff.md
model: "sonnet"
---

# Session 03: Web — level selector UI + play page wiring

Paste this into a new Claude Code session:

```md
## Continuity

Continue from Session 01 artifacts.
Read: `docs/roadmap/vs-computer-stockfish/session-01-handoff.md`
Read: `apps/web/src/app/(play)/play/play-page-client.tsx` (to modify)
Read: `apps/web/src/components/play/invite-create.tsx` (component pattern to follow)
Read: `packages/shared/src/dto/computer-game.dto.ts` (DTOs)

## Mission

Build the level-selector component and wire the "Quick Match" button on the play page so users can choose Stockfish difficulty, color preference, and time control, then launch a computer game.

## Repository anchors

- `apps/web/src/app/(play)/play/play-page-client.tsx` — add 'computer' mode
- `apps/web/src/components/play/` — add `computer-game-setup.tsx` here
- `apps/web/src/lib/api.ts` (or equivalent API client) — add `createComputerGame` call

## Tasks

1. Create `apps/web/src/components/play/computer-game-setup.tsx`:
   - Props: `onCancel: () => void`, `onGameCreated: (gameId: string) => void`
   - Level picker: 8 buttons labeled 1–8 (level 1 = Beginner, 4 = Intermediate, 8 = Master). Show selected level highlighted.
   - Color picker: three options — Play as White, Play as Black, Random (default).
   - Time control picker: Bullet (1+0), Blitz (3+2), Rapid (10+0) — three toggle buttons.
   - "Start Game" button. On click, POST to `/api/computer-games` with `{ level, color, timeControlSeconds, incrementSeconds }`.
   - On success, call `onGameCreated(gameId)`.
   - Use existing shadcn/ui components (`Button`, `Card`, `Badge`) matching the app's design system.

2. Update `apps/web/src/app/(play)/play/play-page-client.tsx`:
   - Add `'computer'` to the `PlayMode` union.
   - When mode is `'computer'`, render `<ComputerGameSetup>` (same layout as the existing `<InviteCreate>` branch).
   - On `onGameCreated`, `router.push('/computer-game/' + gameId)`.
   - Replace the disabled "Quick Match" `Button` with an enabled one that sets mode to `'computer'` and fires a PostHog event `play_clicked` with `{ mode: 'computer' }`.

3. Add `createComputerGame` to the web API client (wherever `fetch('/api/...')` helpers live, e.g. `apps/web/src/lib/api.ts`). It should POST to `/api/computer-games` and return `ComputerGameStateDto`.

## Deliverables

- `apps/web/src/components/play/computer-game-setup.tsx`
- `apps/web/src/app/(play)/play/play-page-client.tsx` (modified)
- `apps/web/src/lib/api.ts` or equivalent (modified to add `createComputerGame`)
- `docs/roadmap/vs-computer-stockfish/session-03-handoff.md`

## Quality gates

    cd apps/web && npm run lint
    cd apps/web && npx tsc --noEmit

## Exit criteria

- `play-page-client.tsx` no longer has the disabled "Quick Match" button; it now activates the `ComputerGameSetup` panel
- `ComputerGameSetup` renders level 1–8 selector, color picker, time control picker, and "Start Game" button
- Zero TypeScript errors in `apps/web`
- Handoff doc written to `docs/roadmap/vs-computer-stockfish/session-03-handoff.md`
```
