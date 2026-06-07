---
depends_on: [03, 12]
touches:
  - "apps/web/src/components/settings/**"
  - "apps/web/src/components/settings/settings-dialog.tsx"
  - "apps/web/src/components/settings/board-theme-picker.tsx"
  - "apps/web/src/components/settings/sound-toggle.tsx"
  - "apps/web/src/components/settings/coordinates-toggle.tsx"
  - "apps/web/src/components/settings/theme-picker.tsx"
  - "apps/web/src/stores/settings-store.ts"
  - "apps/web/src/hooks/use-settings.ts"
  - "apps/web/src/app/settings/page.tsx"
  - "apps/web/src/lib/board/themes.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 22: Board Settings & Themes

## Mission

Give the user meaningful but minimal control over the playing experience: board theme (two options, light/dark plus one alternate), coordinates on/off, sound on/off, low-time sound effects, and the global app theme (light/dark/system). All settings persist in localStorage and respect the user's choice across sessions.

No theme marketplace. No piece set selector. No background art. Two boards, one piece set, that's it.

## Tasks

1. **Settings store** (`settings-store.ts`):
   - Zustand store with `persist` middleware to localStorage.
   - Shape:
     ```ts
     type Settings = {
       appTheme: 'light' | 'dark' | 'system';
       boardThemeId: 'classic' | 'mono';
       coordinates: boolean;
       sound: boolean;
       lowTimeSound: boolean;          // sound tick under 10s
       animations: boolean;            // respects prefers-reduced-motion by default
       pieceSet: 'standard';          // fixed in MVP, but the field exists for future
     };
     ```
   - Defaults: `appTheme = 'system'`, `boardThemeId = 'classic'`, `coordinates = false`, `sound = true`, `lowTimeSound = false`, `animations = true`, `pieceSet = 'standard'`.
2. **Hooks** (`use-settings.ts`):
   - Read + write accessors. Mutations update both the store and any reactive subscribers.
3. **Themes** (`lib/board/themes.ts`):
   - Two board themes:
     - `classic`: warm tan/cream (light) and warm brown (dark), e.g., `#ebecd0` / `#739552`.
     - `mono`: pure neutral — `#e5e5e5` / `#404040`. For users who want the most minimal look.
   - CSS variables for square colors. Updated by setting `data-board-theme` on the board root.
4. **Settings dialog** (`settings-dialog.tsx`):
   - Triggered from the header gear icon and from the active game page's overflow menu.
   - Sections:
     - **Appearance**: app theme (light/dark/system), board theme (radio with two previews).
     - **Board**: coordinates (toggle), animations (toggle).
     - **Sound**: sound on/off, low-time sound (toggle, disabled if sound is off).
   - Closing the dialog commits and applies instantly.
5. **Settings page** (`/settings`):
   - Full-page version of the dialog for accessibility and shareable link.
   - Same content, but with descriptions and a "Reset to defaults" button.
6. **Sound enhancements** (if `lowTimeSound` is enabled):
   - Session 12's sound module already supports move/capture/check/mate. Add a subtle tick (a short click) when the active clock crosses each second under 10 seconds. Off by default.
7. **Coordination with global theme**:
   - `appTheme` is already wired to `next-themes` in Session 03. This session's store mirrors it. The settings dialog and `/settings` page control the same value.
   - Avoid double-source-of-truth: on mount, hydrate the settings store from `next-themes` if the store is empty.
8. **Animations gating**:
   - `animations: false` short-circuits all motion in `<Chessboard>` (Session 12) by setting a class that the board checks. Pieces snap, no fades.
   - Also: if `prefers-reduced-motion: reduce` is set, the effective animations value is `false` regardless of user setting. Show a note in settings.
9. **Header integration**:
   - Add a small gear icon to the header (right side, before user menu). On click, opens settings dialog.
10. **Active game integration**:
    - The game page's overflow menu (kebab) includes a "Board settings" item that opens the same dialog.
11. **Tests**:
    - Store: defaults, persist round-trip, mutation updates subscribers.
    - Dialog: opening/closing, each control mutates the right field, applied to DOM.
    - `lowTimeSound` is disabled if `sound` is false.
    - `prefers-reduced-motion` overrides `animations` (test by mocking the media query).
12. **Verification**:
    - Manual: change every setting, refresh page, settings persist.
    - In DevTools, confirm `data-board-theme` and theme classes change.
    - Lighthouse perf unaffected (settings is a tiny island).

## Deliverables

- `<SettingsDialog>` and `/settings` page.
- Persisted settings store.
- Two board themes wired through CSS variables.
- Low-time sound effect (optional).

## Notes for Downstream Sessions

- The board component (Session 12) reads from the settings store. It does not own its own settings state.
- Do not extend the piece set or theme list in this session. If a future session adds a piece set, the `pieceSet` field is already in the store — only the data and `<Chessboard>` need to grow.
- The settings dialog is intentionally compact. The full `/settings` page exists primarily for screen-reader users who find dialogs disorienting.

## Out of scope (defer)

- Custom user-uploaded themes.
- Per-board preset saves.
- Sync settings across devices (would require backend).
- Sound packs.
