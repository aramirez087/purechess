# Handoff — Purechess "Next Level" Session

> Written 2026-06-10 at the end of the design-elevation session. Read this whole file
> before touching code. Companion context: `design.md` (visual law), `.wolf/cerebrum.md`
> (conventions + Do-Not-Repeat), `.wolf/buglog.json` (known fixes), `docs/ARCHITECTURE.md`.

## 1. State of the app right now

A full design-elevation pass just landed (audit → 8 implementation agents → adversarial
review → fix round). **The diff is LARGE (~75 files) and sits UNCOMMITTED on `main`.**
First action of the next session: review `git status`, then commit it as one or two
logical commits (e.g. `feat(design): silent-tournament elevation pass` + test updates)
before any new work, so new changes diff cleanly.

Verified green at handoff: `tsc --noEmit` clean, 194/194 vitest, all surfaces
screenshot-verified in dark + light + mobile via chrome-devtools MCP.

What the pass delivered (details in `.wolf/cerebrum.md` "design elevation pass" section):

- Unified single-panel game rail (masthead → status → ruled score sheet → docked controls)
- Board feel system: capture-hold, landing settle, drag lift, per-tone brass washes,
  selection hairline, dark legal dots, modal promotion picker (focus trap)
- Review page: printed score card, vertical eval bar on the board, top-bar context line
- Home brand row, hero board coordinates, /play lobby with ghosted Immortal Game
- Brass auth (crest, brass CTA, mono labels, ghosted board), club-ledger /games
- Branded error/loading/empty states everywhere (ErrorState, GameErrorState,
  GameLoadingSkeleton), themed dialogs/toasts/skeletons
- New tokens: `--brass-text`, per-theme `--shadow-elevated`, dark `--success/--warning`

## 2. Quality bar and conventions (do not regress)

- `design.md` is law. Radius scale 14/10/7. One brass accent. Quiet chrome.
- Game screens = bespoke dark hex (`#0b0d0b/#121511/#2b332c/#d6b563`); app surfaces = HSL tokens.
- AA floor for dim mono on `#121511` is `#8a958a`. Small brass text on light-capable
  surfaces must be `text-brass-text`, never `text-brass`.
- Never override tailwind shadow utilities with literal box-shadow rules (bug-125).
- Disabled-but-focusable controls use the aria-disabled pattern (bug-127).
- `pnpm exec vitest run test/` scopes to real unit tests. Editing `tailwind.config.ts`
  requires a dev-server restart.
- OpenWolf protocol applies: cerebrum/buglog/memory updates, anatomy before reads.

## 3. The backlog — ranked

### Tier A — product gaps masquerading as design gaps (highest leverage)

1. **Real-time live PvP.** `live-game-client.tsx` polls every 1.5s; the socket.io
   gateway (`apps/api/src/realtime/`) is a stub and `WsEvent` enums in shared are unused.
   Wire moves/clocks/presence over WS (server emits on move persist; client reconciles
   with the existing optimistic layer). This is the single biggest gap vs chess.com/lichess
   — moves should feel instant and clocks should never drift. Keep the polling path as
   fallback. Mind bug-005 (flag-fall) semantics server-side.
2. **Rating deltas in the ledger.** `/games` Δ column always shows `—`. RatingsService
   computes Glicko-2 on PvP completion — surface `ratingDelta` in the history DTO and
   render the signed delta (token colors already wired in `game-history-row.tsx`).
3. **"Analyze a game" (home CTA says Soon).** The review page + client Stockfish eval
   already exist. Add `/analyze`: paste PGN/FEN → reuse the review shell (board +
   score sheet + eval bar). Mostly composition, not new tech.
4. **Invite random-color quirk** (cerebrum known quirk): preview shows "You play Black"
   for random invites; DB loses the 'random' choice. Needs a column + preview copy fix.

### Tier B — design leftovers, deliberately parked (from the adversarial review minors)

- **Hero board replay** (the audit's best big idea): on first view, animate the last
  3 ply of the Immortal Game (22.Qf6+ gxf6 23.Be7#) using the product's real 200ms
  slide, settling on the static position. IntersectionObserver, reduced-motion skip,
  static FEN fallback. `apps/web/src/components/home/hero-board.tsx`.
- **Primary CTA color decision:** auth uses solid brass, everything else bone
  (`bg-foreground`). Pick one story; if brass stays "the door", document it in design.md.
- **Pill recipe unification:** `game-history-filters.tsx` segmented control vs
  `components/play/pill-styles.ts` — two brass selection grammars. Either consume
  PILL_* in the filters or document the segmented variant in pill-styles.
- **EmptyState extraction:** `games-client.tsx` duplicates two framed empty states
  inline that mostly re-implement `components/error-state.tsx` — extract/reuse.
- **Wire `data-no-animations`:** `animationsDisabled()` checks an attribute nothing
  sets. Have the board settings provider set it on the board container when the
  user turns animations off (then the CSS + JS kill switches both work).
- **Hero "Sign in" is auth-blind** — signed-in users see it. Session-aware swap to
  "Play" / avatar, or accept as marketing-page convention (then note it).
- **Ledger footer tally** counts loaded games only (labeled "shown" when partial);
  consider API total.
- **Eval bar presence:** w-2.5 reads thin at 1600px; consider w-3 + tiny score cap.

### Tier C — surfaces never deeply audited

- **Profile page** (`/profile`) and **Settings dialog** internals — never got the
  audit treatment. Same playbook: screenshot, audit against design.md, fix.
- **Admin section** — only got minimal empty-state swaps. It uses light-theme tokens;
  decide whether it should join the Silent Tournament voice or stay utilitarian.
- **Invite accept page** (`/invite/[token]`) — error path was fixed; happy path never
  reviewed visually.

### Tier D — verification & ship

- **Playwright e2e for the new interactions:** capture-hold, promotion modal keyboard
  flow, full-row ledger navigation (incl. cmd-click), review seek keyboard, result
  overlay actions. Specs live in `apps/web/e2e/`; remember vitest sweeps e2e specs
  (pre-existing quirk — scope vitest to `test/`).
- **Deploy + prod smoke:** `flyctl deploy . -c apps/web/fly.toml --remote-only` (and api
  config; `-c` is mandatory — see cerebrum 2026-06-11 Fly notes). Then designqc against
  https://purechess-web.fly.dev. Mind WASM CSP + SameSite=None notes.
- **Lighthouse pass** on / and a game page (chrome-devtools MCP has lighthouse_audit).

## 4. Verification loop (use it every iteration)

1. `pnpm dev` (web :3000, api :4000). Local Postgres/Redis via `pnpm infra:up`.
2. Drive the app with chrome-devtools MCP: create a computer game via
   `POST /api/computer-games` `{level, color, timeControlSeconds}` **from the browser
   context** (anonymous games are session-bound — curl-created games 403 in the browser).
3. Screenshot dark AND light (`document.documentElement.setAttribute('data-theme','light')`)
   AND mobile (390px). `openwolf designqc` wipes its captures dir per run — save keepers
   to `.wolf/design-audit/`.
4. `pnpm exec tsc --noEmit` + `pnpm exec vitest run test/` in `apps/web` before declaring done.
5. Multi-agent work: strict disjoint file ownership; agents must not touch
   `globals.css`/`tailwind.config.ts`/shared primitives — integrator owns those.
   Adversarially review any large generated diff before trusting it.
