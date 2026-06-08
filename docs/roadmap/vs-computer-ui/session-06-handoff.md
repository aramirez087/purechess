# Session 06 Handoff — Setup Form: Level Selection + Options

## What was done

Rewrote `apps/web/src/components/play/computer-game-setup.tsx` to add:

1. **Unmistakable level selection** — selected level button uses gold fill (`bg-brass text-background font-semibold`) + ring halo + `CheckIcon` in corner. Inactive buttons are clearly dimmer. Hit target raised to `h-11`. `aria-label` added to each button (`Level N Name`). `aria-pressed` preserved.

2. **Time-control picker** — 5-button row (Untimed / Bullet 1|0 / Blitz 3|2 / Blitz 5|0 / Rapid 10|0) using `TIME_CONTROL_PRESETS` from `@purechess/shared`. Default is `untimed` (600s, 0 inc) — identical to prior behavior.

3. **Strength mode toggle** — "By Level" (existing 1–8 grid) vs "ELO Target" (range slider + number input, 600–2800 ELO). ELO mode hides the level grid and sends `eloTarget` in payload; `level` defaults to 4 as required by API.

4. **Human-like play switch** — Radix `Switch` with `aria-label="Human-like play"`. When on, sends `styleBlunderCp: 50` in payload.

5. **Think-time picker** — 4-button row (Auto / Fast / Normal / Slow). Auto omits `thinkTimeMs`; others send 300 / 1000 / 2500 ms.

6. **Dynamic header copy** — subtitle under "Play vs Computer" updates reactively: `{timeLabel} · {strengthLabel}`.

7. **Full payload construction** — all optional fields spread conditionally; defaults preserve exact prior behavior.

## Decisions and rationale

- **Gold fill + ring for selected buttons** (not just border tint): unambiguous on dark backgrounds; matches premium-dark design bar.
- **`level: 4` fallback in ELO mode**: API `CreateComputerGameDto.level` is required; service uses `eloTarget` to override engine UCI_Elo, ignoring `level` when present.
- **`styleBlunderCp: 50`** as the hardcoded human-like value: ±50cp noise window is the canonical "club player" setting; configurable per spec if needed later.
- **`TIME_CONTROL_PRESETS` import from shared** rather than redefining constants: single source of truth.
- **No stub imports for opening-picker / fen-setup**: session-01-handoff.md was not on this branch; those imports don't exist in the file and are not needed until Session 07.

## Backward compatibility

Default state (no user selections) produces exactly:
```json
{ "level": 4, "color": "random", "timeControlSeconds": 600, "incrementSeconds": 0 }
```
No `eloTarget`, `styleBlunderCp`, or `thinkTimeMs` — identical to prior session behavior.

## Files produced

| File | Action |
|------|--------|
| `apps/web/src/components/play/computer-game-setup.tsx` | Modified |
| `apps/web/test/play/computer-game-setup.test.tsx` | Created |
| `docs/roadmap/vs-computer-ui/session-06-handoff.md` | Created |

## Quality gate results

- `pnpm --filter @purechess/shared build` — clean
- `cd apps/web && pnpm typecheck` — clean (no new errors)
- `cd apps/web && pnpm lint` — clean
- `cd apps/web && pnpm exec vitest run test/` — 143/143 pass (6 new tests)

## Open issues

None. All tasks complete.

## Inputs Session 07 needs

- Session 07 implements opening-picker + fen-setup stubs (per session-01-handoff). Those features are NOT imported in this file; Session 07 will add them.
- `computer-game-setup.tsx` accepts `onCancel` + `onGameCreated` callbacks — unchanged API.
- The `CreateComputerGameDto` is fully typed; `eloTarget`, `styleBlunderCp`, `thinkTimeMs` are optional fields already in the shared DTO.
