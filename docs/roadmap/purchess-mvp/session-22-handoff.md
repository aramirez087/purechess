# Session 22 Handoff — Board Settings

## What Was Built

### New files
| Path | Purpose |
|---|---|
| `apps/web/src/lib/board/themes.ts` | `BOARD_THEMES` array, `BoardThemeId` type, `applyBoardTheme(id)` — sets `data-board-theme` on `document.documentElement` |
| `apps/web/src/stores/settings-store.ts` | Zustand + `persist` to localStorage key `purchess-settings`; full `Settings` type; `update(patch)` + `reset()` actions; `skipHydration: true` |
| `apps/web/src/hooks/use-settings.ts` | `useSettings()`, `useUpdateSettings()`, `useResetSettings()` — typed selectors over settings store |
| `apps/web/src/components/settings/settings-form.tsx` | Reusable form: Appearance (app theme radio, board theme radio w/ color previews), Board (coordinates, animations w/ reduced-motion note), Sound (sound toggle, low-time tick toggle) |
| `apps/web/src/components/settings/settings-dialog.tsx` | `<SettingsDialog>` — gear icon `DialogTrigger` + dialog wrapping `<SettingsForm>` |
| `apps/web/src/app/settings/page.tsx` | Server component wrapper exporting metadata |
| `apps/web/src/app/settings/settings-page-client.tsx` | Client page: `<AppShell>` + `<SettingsForm>` + "Reset to defaults" button |
| `apps/web/test/settings/settings-store.test.ts` | 6 store unit tests |
| `apps/web/test/settings/settings-dialog.test.tsx` | 6 dialog/form tests incl. reduced-motion mock |

### Modified files
| Path | Change |
|---|---|
| `apps/web/src/lib/board/types.ts` | Added `'tick'` to `SoundType` |
| `apps/web/src/lib/board/sound.ts` | Added `tick` tone params; added `playTick(lowTimeSoundEnabled)` method on `SoundEngine` |
| `apps/web/src/lib/board/themes.ts` | (new, see above) |
| `apps/web/src/components/board/board-context.tsx` | Replaced local `useState` with `useSettingsStore`; rehydrates on mount; applies board theme and sound enabled state via effects; derives `effectiveAnimations` from `animations && !prefersReducedMotion()` |
| `apps/web/src/app/globals.css` | Added `[data-board-theme="mono"]` CSS vars; added `[data-no-animations]` rules |
| `apps/web/src/app/providers.tsx` | Added `<ThemeSync>` — bridges next-themes ↔ settings store bidirectionally on mount and change |
| `apps/web/src/components/layout/AppShell.tsx` | Added `<SettingsDialog>` before `<UserMenu>` in header |
| `apps/web/src/stores/ui.store.ts` | Removed dead `theme`/`setTheme` fields; replaced with `sidebarOpen` placeholder |
| `apps/web/vitest.setup.ts` | Added `window.matchMedia` mock for jsdom |

### Design decisions
- **Single source of truth for appTheme**: `next-themes` owns the value; `ThemeSync` component syncs bidirectionally with the settings store. Condition guards (`!==`) prevent infinite loops.
- **Board theme**: `data-board-theme` attribute on `document.documentElement`; `classic` = no override (existing `:root` vars), `mono` = explicit override.
- **`BoardSettingsContext`**: now a thin adapter over `useSettingsStore` instead of local state. Public API (`settings`, `updateSettings`) unchanged — downstream sessions unaffected.
- **`ui.store.ts`**: gutted `theme`/`setTheme` (dead since session 03), kept file with minimal `sidebarOpen` state to avoid breaking any future import of the path.

## Verification Evidence

```
# Lint
pnpm lint → ✔ No ESLint warnings or errors

# Tests
pnpm test → 8 test files, 59 tests, all passed

# TypeCheck
pnpm typecheck — only pre-existing errors:
  - @purchess/shared not installed in worktree (documented in session 03 handoff)
  - Two pre-existing chessboard.tsx type errors (session 12 scope)
  No new errors introduced by session 22.
```

## Open Issues / Known Gaps

- `BoardSettingsContext.updateSettings` patch path for `animationMs` → `animations` is approximate (> 0 → true). Session 14 should use `useSettingsStore` directly rather than `useBoardSettings().updateSettings` for fine-grained control.
- `ThemeSync` may fire one extra render on mount before rehydration completes — harmless but worth monitoring if flash is observed.
- `ui.store.ts` `sidebarOpen` state is a placeholder. Remove or extend in the session that builds a sidebar.
- Low-time tick consumer (session 14 game clock) must call `soundEngine.playTick(useSettingsStore.getState().lowTimeSound)` — the method exists but no caller yet.

## Inputs Downstream Sessions Can Rely On

### Paths
- Settings store: `apps/web/src/stores/settings-store.ts`
- Settings hooks: `apps/web/src/hooks/use-settings.ts`
- Settings dialog: `apps/web/src/components/settings/settings-dialog.tsx`
- Board themes: `apps/web/src/lib/board/themes.ts`
- Settings page: `/settings`

### Exported symbols
```ts
import { useSettingsStore, SETTINGS_DEFAULTS } from '@/stores/settings-store'
import type { Settings } from '@/stores/settings-store'
import { useSettings, useUpdateSettings, useResetSettings } from '@/hooks/use-settings'
import { SettingsDialog } from '@/components/settings/settings-dialog'
import { BOARD_THEMES, applyBoardTheme } from '@/lib/board/themes'
import type { BoardThemeId } from '@/lib/board/themes'
import { soundEngine } from '@/lib/board/sound'
// soundEngine.playTick(lowTimeSoundEnabled: boolean) — call when clock < 10s
```

### Settings shape (stable)
```ts
type Settings = {
  appTheme: 'light' | 'dark' | 'system';
  boardThemeId: 'classic' | 'mono';
  coordinates: boolean;
  sound: boolean;
  lowTimeSound: boolean;
  animations: boolean;
  pieceSet: 'standard';
}
```

### CSS
- `[data-board-theme="mono"]` — mono squares override on `<html>`
- `[data-no-animations]` — disables all board transitions (set on board root when `effectiveAnimations = false`)

### Env keys
No new env keys.
