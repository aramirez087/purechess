---
session: 7
title: "Openings & positions: ECO picker, custom FEN setup, random opening"
depends_on: [1]
touches:
  - apps/web/src/components/computer-game/opening-picker.tsx
  - apps/web/src/components/computer-game/fen-setup-board.tsx
  - apps/web/src/lib/openings/eco.ts
  - apps/web/src/lib/openings/index.ts
  - apps/web/test/openings/openings.test.ts
parallel_safe: true
produces:
  - apps/web/src/components/computer-game/opening-picker.tsx
  - apps/web/src/components/computer-game/fen-setup-board.tsx
  - apps/web/src/lib/openings/eco.ts
  - apps/web/src/lib/openings/index.ts
  - apps/web/test/openings/openings.test.ts
model: "sonnet"
---

# Session 07: Openings & custom positions

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md for the
opening-picker + fen-setup stub contracts (the charter slotted them into computer-game-setup.tsx;
do NOT edit that form — only fill your own files). Read foundations session-01 handoff for
CreateFromFenDto + CreateComputerGameDto.

Mission: Let the player start from a known opening (ECO name) or a custom FEN, plus a "random
opening" option, feeding the create/create-from-FEN payload.

Repository anchors:
- apps/web/src/components/computer-game/{opening-picker,fen-setup-board}.tsx (stubs)
- apps/web/src/lib/openings/{eco,index}.ts (new: a compact ECO dataset + lookup helpers)
- apps/web/src/lib/api/computer-games.ts (createComputerGameFromFen from foundations Session 04)
- chess.js (already a dep) for FEN validation + applying opening moves

Tasks:
1. lib/openings: ship a compact curated ECO list (code, name, moves/FEN) covering common openings;
   export lookupByName, eco lookup for a FEN/move list, and a randomOpening() helper. Keep the data
   file reasonable in size (curated, not the full 3k-line book).
2. OpeningPicker: a searchable dropdown (Radix dropdown/command-style) of openings + a "Random"
   action; selecting one sets the starting FEN/moves in the create payload and shows the ECO name.
3. FenSetupBoard: a paste-a-FEN input with validation (chess.js) + a small read-only preview using
   the existing Chessboard; invalid FEN shows an inline error. Feeds createComputerGameFromFen.
4. Vitest test: lookupByName returns the right ECO; randomOpening yields a legal FEN; invalid FEN is
   rejected by the setup board helper.

Deliverables: filled two components + lib/openings + test; handoff at
docs/roadmap/vs-computer-ui/session-07-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: opening picker + random + custom-FEN produce a valid starting position fed to the
create payload; invalid FEN is blocked; tests pass.
```
