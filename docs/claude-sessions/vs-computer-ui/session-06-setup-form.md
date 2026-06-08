---
session: 6
title: "Setup form: clear level selection, time controls, ELO/style/think-time"
depends_on: [1]
touches:
  - apps/web/src/components/play/computer-game-setup.tsx
  - apps/web/test/play/computer-game-setup.test.tsx
parallel_safe: true
produces:
  - apps/web/src/components/play/computer-game-setup.tsx
  - apps/web/test/play/computer-game-setup.test.tsx
model: "sonnet"
---

# Session 06: Game setup & options

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md (the
charter pre-slotted opening-picker + fen-setup stubs into this form — leave those import lines
intact; do not implement them, Session 07 does). Read
docs/roadmap/vs-computer-foundations/session-01-handoff.md for CreateComputerGameDto's new fields.
Edit ONLY computer-game-setup.tsx + its test.

Mission: Fix the unclear level selection and add the missing create-game options — time controls,
ELO-target mode, style/blunder knob, and engine think-time.

Repository anchors:
- apps/web/src/components/play/computer-game-setup.tsx (level state, 1-8 buttons at ~L88, selected
  styling at ~L97 with aria-pressed; "Untimed" copy at ~L73; posts CreateComputerGameDto)
- packages/shared/src/dto/computer-game.dto.ts (timeControlSeconds, incrementSeconds, eloTarget,
  thinkTimeMs, styleBlunderCp), packages/shared/src/time-control.ts (categories)

Tasks:
1. Make the SELECTED level unmistakable: strong active treatment (gold fill/ring + check), clear
   inactive contrast, larger hit target; keep aria-pressed and add a visible label of the choice.
2. Add a time-control picker: Untimed (default, current behavior) + bullet/blitz/rapid presets that
   set timeControlSeconds/incrementSeconds in the create payload; show the picked control.
3. Add a strength mode toggle: difficulty level (existing) OR ELO target (slider/number ->
   eloTarget). Add a "human-like" style/blunder option (-> styleBlunderCp) and a think-time select
   (-> thinkTimeMs). All optional, sensible defaults, typed via the shared DTO.
4. Keep the bespoke premium-dark styling and full payload backward-compatible (untimed + level still
   works with no extra selection).
5. Vitest test: selecting a level reflects in aria-pressed + payload; choosing blitz sets time
   fields; ELO mode sends eloTarget instead of/with level.

Deliverables: updated computer-game-setup.tsx + test; handoff at
docs/roadmap/vs-computer-ui/session-06-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: selected level is visually obvious; time-control + ELO + style + think-time feed the
create payload; defaults preserve current untimed/level flow; tests pass.
```
