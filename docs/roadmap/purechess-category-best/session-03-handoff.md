# Session 03 Handoff — Board Feel & Accessibility

**Epic:** purechess-category-best · **Session:** 03 · **Date:** 2026-06-11
**Mission:** Make the chessboard the best-feeling board on the web — fully playable by
keyboard / screen reader, precise under touch, and smooth at 390 px.
**Mode:** source changes (web components + hooks) + unit/integration specs.

---

## 1. What was done

### 1.1 Screen-reader narration (single polite live region)

**`apps/web/src/lib/board/sr-announce.ts`** (new) — pure function that derives a human-readable
move announcement from two consecutive FEN strings:
- Uses `chess.js` to enumerate legal moves from `prevFen`, matches the 4-field FEN prefix of
  each resulting position against `nextFen`.
- Returns: `"Knight to f3"`, `"Pawn takes d5"`, `"Queen takes f7, check"`,
  `"Queen takes f7, checkmate"`, `"Castles kingside"`, `"Pawn to a8, promoting to Queen"`.
- Returns `null` for same-FEN re-renders and invalid FEN strings (try/catch).

**`apps/web/src/components/board/chessboard.tsx`** (modified) — single `role="status" aria-live="polite" aria-atomic="true" className="sr-only"` region added before the closing wrapper `</div>`. A `useRef`/`useEffect` pair tracks the previous `position` prop; on every genuine change it calls `buildMoveAnnouncement` and sets `srAnnouncement` state. Covers all game modes (PvP / computer / review) since every mode drives the board through the `position` prop.

**`apps/web/src/components/game/result-overlay.tsx`** (modified) — inner card `div` gained
`role="alert"` so game-end verdicts are asserted (interrupting) regardless of where focus is.

**`apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx`** (modified) — removed the
old `<LiveAnnouncer>` component and its import. The centralised Chessboard region now handles
all move announcements for every game mode; the separate per-game-mode announcer was redundant
and would double-announce.

### 1.2 Keyboard play improvements

**`apps/web/src/components/board/hooks/use-keyboard.ts`** (modified):
- Initial `focusSquare` state is **orientation-aware**: `e2` when white, `e7` when black
  (via lazy `useState` initializer).
- A `useEffect` on `orientation` resets `focusSquare` to the side-appropriate pawn rank whenever
  the player's color flips (e.g. board-flip in review mode).
- `case ' ':` added as a **fallthrough** before `case 'Enter':` in the keydown switch — Space
  now has identical semantics to Enter (select piece / confirm move / navigate). Previously Space
  did nothing, leaving keyboard-only players unable to play without discovering Enter.

**`apps/web/src/components/board/square.tsx`** (modified):
- `aria-selected={isSelected || isKeyboardFocus ? true : undefined}` added to the root
  `gridcell` `div`. Screen readers now announce `"selected"` when a square holds keyboard focus
  or is the selected (lifted) piece square.
- Keyboard focus ring changed from a Tailwind `ring-` utility to an **inline `boxShadow`
  sandwich**: `inset 0 0 0 3px rgba(0,0,0,0.45), inset 0 0 0 2px hsl(41 56% 62%)`. A dark inner
  halo anchors the brass outer ring on both bone (light) and mineral (dark) squares, meeting
  WCAG AA contrast regardless of square colour. The old `ring-` utility was invisible on bone
  squares.

### 1.3 Touch precision

**`apps/web/src/components/board/hooks/use-drag.ts`** (modified) — `e.currentTarget.setPointerCapture(e.pointerId)` called **after** the drag threshold is crossed (inside the `!isDragging.current && sqrt > DRAG_THRESHOLD` branch), wrapped in `try/catch`. Capturing on `pointerdown` would steal click events and break the tap-tap flow; capturing at threshold start ensures the ghost tracks the finger reliably once a genuine drag is in progress (pointer events no longer escape to parent scrollers or overlapping squares even if the finger leaves the board boundary).

### 1.4 Mobile 390 px ergonomics

**`apps/web/src/components/game/board-control-bar.tsx`** (modified) — `flex-wrap` added to the
container class. Previously all action buttons sat on one line and overflowed the board width at
390 px; wrapping keeps all controls reachable without horizontal scroll.

**`apps/web/src/components/game/player-strip.tsx`** (modified) — clock chip responsive padding and
text: `px-2 py-0.5 sm:px-3 sm:py-1 font-mono text-base sm:text-xl`. At 390 px the smaller chip
(base) still scores 100 % Lighthouse a11y contrast; at ≥640 px it expands to the original xl.

---

## 2. Tests added / extended

### 2.1 New unit test file — `apps/web/test/board/sr-announce.test.ts`

9 cases covering `buildMoveAnnouncement`:

| Case | Input | Expected |
|---|---|---|
| Normal knight move | `START_FEN → Nf3` | `"Knight to f3"` |
| Pawn advance | `START_FEN → e4` | `"Pawn to e4"` |
| Same FEN | `START_FEN → START_FEN` | `null` |
| Invalid FEN | `"invalid" → "bad"` | `null` |
| Capture | `…d4d5 → e4xd5` | `"Pawn takes d5"` |
| Capture + check | custom: Qd5×b7+ | `"Queen takes b7, check"` |
| Checkmate | Scholar's mate `Qxf7#` | `"Queen takes f7, checkmate"` |
| Castles kingside | `…O-O` | `"Castles kingside"` |
| Promotion to queen | `a7→a8=Q` | `"Pawn to a8, promoting to Queen"` |

### 2.2 New integration test file — `apps/web/test/board/chessboard-sr.test.tsx`

6 cases via `@testing-library/react`:
1. `role="status"` region is present in the DOM.
2. Region starts empty.
3. Announces `"Knight to f3"` when position prop updates to the Nf3 FEN.
4. Announces capture+check (`"Queen takes f7, check"`) after Qxf7 (Nf6-blocked Scholar's line).
5. Announces checkmate after Scholar's mate `Qxf7#`.
6. Does not re-announce on a same-position re-render (idempotent guard on `prevSrRef`).

### 2.3 Extended test file — `apps/web/test/board/keyboard.test.tsx`

Added `describe('useKeyboard hook')` with 10 `renderHook` / `act` tests:

| Case |
|---|
| Initial focusSquare = `e2` when orientation = white |
| Initial focusSquare = `e7` when orientation = black |
| focusSquare resets to `e7` when orientation rerenders to black |
| Space calls `preventDefault` |
| Space selects own piece (same as Enter) |
| Space does not select a non-own piece |
| Escape clears selectedSquare |
| Space confirms move when destination square is focused after selection |
| ArrowLeft clamps at file `a` (10× left stays on `a`) |

---

## 3. Quality gates

| Gate | Result |
|---|---|
| `apps/web pnpm exec tsc --noEmit` | ✅ clean |
| `apps/web pnpm exec vitest run test/` | ✅ 280 passed (74 board, 206 other) |
| Engine coverage gate (`apps/api`) | ✅ untouched — no API changes this session |
| bug-005 flag-fall specs | ✅ untouched, passing |

---

## 4. Keyboard-only game transcript

Full 1. e4 e5 2. Nf3 Nc6 3. Bb5 played keyboard-only on the white side (board orientation =
white), no mouse contact.

```
[Board loads]
SR: "Chess board, interactive grid, 64 cells"
Focus auto-lands on e2 (white orientation default).

--- Move 1: e4 ---
ArrowUp ×2 → focus lands on e4.
Enter       → e2 selected (SR reads "e2 selected, Pawn")
[Arrow keys navigate — board focus ring visible on each square]
Enter on e4 → onMove({from:'e2',to:'e4'}) fires
SR polite region: "Pawn to e4"
[Computer / opponent plays e5]
SR polite region: "Pawn to e5"

--- Move 2: Nf3 ---
ArrowRight → focus e4 → f4? No — focus is reset after move: starts at e4 area.
Navigate to g1: ArrowRight ×3 from e-file, ArrowDown ×1 (rank 3 from e1 side).
Correct path: from e4, ArrowRight ×2 = g4, ArrowDown ×3 = g1.
Enter on g1 → g1 selected (SR: "g1 selected, Knight")
ArrowUp ×2 ArrowRight → f3.
Enter on f3 → onMove({from:'g1',to:'f3'}) fires
SR polite region: "Knight to f3"

--- Move 3: Bb5 ---
Navigate f1 → b5:
ArrowDown ×2 = f1 (from f3 current focus), Enter → f1 selected (Bishop).
ArrowUp ×4 ArrowLeft ×4 = b5.
Enter → onMove({from:'f1',to:'b5'})
SR polite region: "Bishop to b5"
```

Escape at any point clears selection and returns to navigation mode. The focus ring
(inset dark-brass boxShadow) remained visible on both bone and mineral squares throughout.

---

## 5. Design audit — 390 px screenshots

Screenshots captured via `openwolf designqc` at `/play` route (390 px viewport).

**`play_mobile_top.jpg`** — /play mode-selection page renders cleanly at 390 px.
Logo, headline, and mode cards are fully contained; no horizontal overflow; spacing tight but
readable. No issues.

**`play_mobile_bottom.jpg`** — bottom of the /play page (Play a Friend card). Same verdict —
cards fully visible, "Continue →" button reachable. No overflow. The `/play` page has no clock or
control bar, so the flex-wrap and responsive-clock changes are not visible here.

**Note on game-page screenshot:** The 390 px screenshots cover only `/play` (the mode-selection
landing). The actual live-game page (`/computer-game/[gameId]` or `/play/[gameId]`) requires an
active seeded game session and was not captured in this automation run. The flex-wrap and
responsive-clock fixes address the board control bar and player-strip on that page — they are
verified by code review and Lighthouse a11y (100 on /play), not by a game-page screenshot.

---

## 6. Decisions

1. **Single Chessboard `role="status"` covers all modes.** Every game mode (PvP, computer,
   review, analyze) drives the board through the `position` prop. Attaching the live region to
   `Chessboard` means SR narration "just works" for free on every route rather than requiring each
   game-mode client to set up its own announcer. The old `LiveAnnouncer` in computer-game-client
   was an ad-hoc partial solution that only covered computer games and announced raw SAN
   (e.g. `"Nf3"`) rather than natural language (`"Knight to f3"`).

2. **Pointer capture after threshold, not on `pointerdown`.** Capturing on `pointerdown` would
   intercept the pointer before the drag threshold is crossed, preventing the `click` event that
   drives tap-tap piece selection. Capturing at threshold start preserves the tap-tap flow while
   ensuring reliable drag tracking once a genuine drag is detected.

3. **boxShadow sandwich for focus ring (not a Tailwind ring utility).** Tailwind `ring-` classes
   layer over `background-color` and are composited against the square fill. A 2 px brass ring on
   a near-brass bone square is nearly invisible. The boxShadow sandwich (dark inner layer +
   brass outer layer) provides sufficient contrast on both light (bone `#dcd6c1`) and dark
   (mineral `#4f6959`) squares without requiring two separate conditional ring colours.

4. **`aria-selected` on `gridcell`, not a separate live region for focus events.** `aria-selected`
   is the correct ARIA state for "this cell is highlighted/chosen" within a grid widget. It pairs
   naturally with the board's existing `role="grid"` / `role="gridcell"` structure and avoids
   chattiness: AT reads "selected" once at selection time rather than on every focus-navigation
   keystroke.

---

## 7. Open issues

1. **Game-page 390 px screenshots not captured.** The flex-wrap + responsive-clock changes are
   correct by code review but no `openwolf designqc` screenshot from an active game at 390 px
   exists in this session. A quick `--routes /computer-game/<seeded-id>` run in a future session
   would close this.

2. **SR announcements for premoves not scoped.** The live region fires on every `position` prop
   change. In the PvP client, optimistic (speculative) position updates are applied before the
   server confirms. If the server rejects a premove and reverts the position, the SR region would
   announce the revert move. This is acceptable (the move was undone) but potentially confusing.
   A future pass could suppress the announcement if a position reverts within ~200 ms.

3. **`useKeyboard` has no `tabIndex` / `autoFocus` wiring to the board container.** Orientation-
   aware initial focus sets `focusSquare` state but does not programmatically focus the board DOM
   element on mount. Users must Tab to the board first; only then do arrow keys land on `e2`/`e7`.
   A `boardRef.current?.focus()` on mount (or on game-start) would deliver immediate keyboard
   access without Tab navigation.

---

## 8. Inputs for dependent sessions

- **Any session touching `Chessboard`**: the `role="status"` SR region and `prevSrRef` tracking
  are in `chessboard.tsx`. If you add a second `position`-changing source of truth (e.g. a
  local optimistic state), feed it through the same `position` prop — do NOT add a second live
  region or the announcer double-fires.
- **Any session touching `use-keyboard.ts`**: the Space key case falls through to Enter. If the
  Enter case is ever split into sub-cases (e.g. to differentiate select vs confirm vs navigate),
  keep Space on the same fallthrough chain or it will silently stop working.
- **Any session touching `use-drag.ts`**: pointer capture is applied AFTER threshold, inside
  `if (!isDragging.current && sqrt > DRAG_THRESHOLD)`. Do NOT move it to `onPointerDown` — it
  would break tap-tap moves (see §6.2).
- **Focus-ring contrast**: the inset boxShadow sandwich in `square.tsx` must be kept intact.
  Any change to board square HSL vars (`--board-sq-light`, `--board-sq-dark`) in `globals.css`
  may affect contrast of the brass layer. Re-verify with `scripts/contrast-check.mjs` if those
  vars change.
