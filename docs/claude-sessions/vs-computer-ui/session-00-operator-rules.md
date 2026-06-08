# Session 00 — Operator Rules (vs-computer-ui)

These rules apply to **every** session in this epic. Read them first, every time. Each
session is a fresh Claude Code process with **zero memory** of prior sessions — all
continuity flows through files referenced by path. This epic runs **after**
`vs-computer-foundations` has merged to the shared trunk; consume its capabilities via the
handoffs under `docs/roadmap/vs-computer-foundations/`.

## Role

You are a senior front-end engineer on **PureChess** (Next.js 14 App Router, Radix UI +
Tailwind + `class-variance-authority`, Zustand, TanStack Query, `chess.js` for client board
logic). This epic builds the **vs-computer player UI** on top of the endpoints, engine
client, and data-layer wrappers delivered by the foundations epic.

## Project ground truth

- **OpenWolf protocol.** Check `.wolf/anatomy.md` before reading a file; read
  `.wolf/cerebrum.md` (esp. `## Do-Not-Repeat` + `## User Preferences`) and
  `.wolf/buglog.json` before coding. Append to `.wolf/memory.md` after actions, update
  `.wolf/anatomy.md` on new files, log fixes to `.wolf/buglog.json`.
- **Design bar is HIGH.** The user wants it to look better than chess.com: full-bleed,
  viewport-filling, premium-dark (near-black `#0b0d0b` / panel `#121511` / gold `#d6b563`).
  Game/play screens are **chromeless** — no global top app bar; brand + settings live in the
  rail header. Match the existing bespoke-hex styling in `computer-game-client.tsx`.
- **Reusable game shell** lives in `apps/web/src/components/game/` (GameShell, BoardColumn,
  PlayerStrip, GameRail, MovePanel, BoardControlBar). `MovePanel` ALREADY accepts
  `onSeek?(ply)` + `currentPly`. `PlayerStrip` ALREADY accepts `clock?: string`. Reuse these
  props — do not fork the components.
- **Computer games are client-side Stockfish.** The browser computes moves and POSTs each to
  the API; never assume a server engine. Engine analysis (eval/hint/PV) comes from
  `apps/web/src/lib/engine/stockfish-client.ts`.
- **Premoves are pointless vs the computer** — disable them on this surface.
- `@purechess/shared` **must be built** before web typecheck/build:
  `pnpm --filter @purechess/shared build`.
- **Web Vitest sweeps e2e/ specs by default** → run `pnpm exec vitest run test/` to scope to
  real unit tests (`.wolf/cerebrum.md` Key Learnings).
- `element.scrollIntoView` is undefined in jsdom — call it optionally: `el?.scrollIntoView?.(…)`.

## Architecture for this epic

Session 01 (charter) refactors `computer-game-client.tsx` into a thin **shell** that consumes
a **controller hook** (`use-computer-game.ts`) exposing all state + actions, and composes
**stub** presentational components/hooks (one file per feature). **Feature sessions fill only
their own stub files** — they must NOT edit the shell, the controller, the shared board, or
another feature's files. The charter wires every slot; features implement bodies. This is
what keeps the wave parallel-safe.

## Hard constraints

- TypeScript + Prettier + ESLint (root `eslint.config.js`). a11y: keyboard-operable controls,
  visible focus rings, `aria-*` where needed (the repo ships an accessibility skill).
- Reuse Radix primitives already in `apps/web/package.json` (dialog, dropdown, switch, tabs,
  tooltip, radio-group) — do not add new UI deps without need.
- No raw WS strings — use the `WsEvent` enum from shared if you touch realtime.
- No `TODO`/`FIXME` left behind. New components get a Vitest test.

## Handoff convention

**End every session by writing a handoff under `docs/roadmap/vs-computer-ui/`** named
`session-NN-handoff.md`: what was done, decisions + rationale, open issues, exact files
produced, and explicit inputs the next session needs. Never assume memory.

## Definition of done (every session)

1. `pnpm --filter @purechess/shared build` succeeds.
2. `cd apps/web && pnpm typecheck && pnpm lint` clean.
3. `cd apps/web && pnpm exec vitest run test/` passes (new components have tests).
4. The vs-computer page renders without console errors for the feature you touched.
5. Decisions documented and a handoff written under `docs/roadmap/vs-computer-ui/`.
