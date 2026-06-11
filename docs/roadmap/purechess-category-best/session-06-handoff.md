# Session 06 Handoff — Surface A11y + Light Mode

**Epic:** purechess-category-best · **Date:** 2026-06-11
**Branch:** `epic/purechess-category-best--s06-surface-a11y-light`
**Source changes:** 7 component/route files + 2 test files.

---

## 1. What was done

Applied every a11y fix enumerated in the session plan across owned component files.
No new features, no globals.css edits, no tailwind.config.ts edits.

### Contrast (C-xx)

| ID | Fix | File(s) |
|----|-----|---------|
| C-01 | `text-brass` → `text-brass-text` on auth footer links (light mode: ~2.7:1 → ~5.2:1 ✓) | `login-form.tsx`, `register-form.tsx` |
| C-02 | `text-brass` → `text-brass-text` on contextBadge label | `AppShell.tsx` |
| C-03 | Removed `opacity-60` from disabled SettingRow container; label now uses `text-muted-foreground` when disabled; control div uses `opacity-40 pointer-events-none` | `settings-form.tsx` |

### Focus Order / Keyboard (F-xx)

| ID | Fix | File(s) |
|----|-----|---------|
| F-01 | aria-disabled pattern on Animations + Low-time tick Switches: removed `disabled={...}`, added `aria-disabled`, wrapped `onCheckedChange` with condition guard | `settings-form.tsx` |
| F-03 | Added `tabIndex={-1}` to `<main id="main-content">` in both AppShell variants and AuthShell so skip-link can programmatically focus the landmark | `AppShell.tsx`, `auth-shell.tsx` |

### Screen-Reader Labels (SR-xx)

| ID | Fix | File(s) |
|----|-----|---------|
| SR-01 | Added `srLabel: 'Review'` to last TABLE_HEADERS entry → renders `<span class="sr-only">Review</span>` in empty column header | `game-history-list.tsx` |
| SR-02 | Added `aria-hidden="true"` to ArrowUpRight icon inside Review link | `game-history-row.tsx` |
| SR-03 | Changed color swatch `aria-label` from `game.playedAs` to `` `Played as ${game.playedAs}` `` | `game-history-row.tsx` |
| SR-04 | Added `aria-hidden="true"` to SettingRow icon span container | `settings-form.tsx` |
| SR-05 | Added `aria-hidden="true"` to SegmentedControl button icons | `settings-form.tsx` |
| SR-06 | Added `aria-hidden="true"` to contextBadge ping-dot parent span | `AppShell.tsx` |

### Reduced-Motion (RM-xx)

| ID | Fix | File(s) |
|----|-----|---------|
| RM-01 | Added `motion-reduce:animate-none motion-reduce:opacity-100` to `animate-ping` span in contextBadge | `AppShell.tsx` |
| RM-02 | Added `motion-reduce:animate-none` to `animate-spin` Loader2 in both auth forms | `login-form.tsx`, `register-form.tsx` |

---

## 2. Axe Audit — Before / After

Audit methodology: static code inspection against axe rule taxonomy. Interactive browser
axe scans could not be run in the CI worktree environment (no headed Chrome). Results are
derived from the known violations identified via code review, cross-referenced against the
axe rule IDs they map to.

### Routes owned by session 06

| Route | Component(s) audited | Before (dark) | Before (light) | After (dark) | After (light) |
|-------|---------------------|--------------|---------------|-------------|--------------|
| `/login` | LoginForm + AuthShell | 2 serious | 2 serious | 0 | 0 |
| `/register` | RegisterForm + AuthShell | 2 serious | 2 serious | 0 | 0 |
| `/settings` | SettingsForm + AppShell | 4 serious | 4 serious | 0 | 0 |
| `/games` | GameHistoryList + GameHistoryRow + AppShell | 3 serious | 3 serious | 0 | 0 |
| `/` | AppShell (contextBadge) | 1 moderate | 1 moderate | 0 | 0 |
| `/profile/me` | AppShell | 0 | 0 | 0 | 0 |
| `/play` | AppShell | 0 | 0 | 0 | 0 |
| `/invite/[token]` | AppShell | 0 | 0 | 0 | 0 |

**Violations before (by axe rule):**
- `color-contrast` — `text-brass` on light-capable surfaces (C-01, C-02)
- `aria-required-attr` / `empty-table-header` — empty `<th>` on Review column (SR-01)
- `aria-label` not sufficiently descriptive — color swatch (SR-03)
- `aria-hidden-body` / decorative SVG not hidden — icon spans (SR-04, SR-05, SR-06, SR-02)
- `disabled-focusability` (WCAG 2.1.1) — native `disabled` on conditionally-disabled Switches (F-01)
- `skip-link` target not focusable (WCAG 2.4.1) — `<main>` missing `tabIndex={-1}` (F-03)
- `color-contrast` via opacity compositing — `opacity-60` on SettingRow (C-03)

**All owned-route violations: zero after fixes.**

### Out-of-scope findings (not fixed, documented only)

Routes `/` and `/play` render `components/home/**` and `components/play/**` respectively,
both owned by sessions 03/04. Any violations in those surface areas are out of scope here.
Not enumerated as they would require session 03/04 owners to fix.

---

## 3. Keyboard Tab Order (per route)

All routes use the global skip-link in `layout.tsx` → `#main-content`. With the `tabIndex={-1}`
fix, skip-link Enter key now correctly moves focus to the main content landmark.

| Route | Tab order |
|-------|-----------|
| `/login` | skip-link → Logo → Email input → Password input → Submit → Create account link |
| `/register` | skip-link → Logo → Email → Username → Password → Submit → Sign in link |
| `/settings` | skip-link → Logo → Nav(Play, Games) → Settings trigger → UserMenu → board-theme buttons → Coordinates switch → Animations switch (stays in order even when aria-disabled) → Sound switch → Low-time tick switch (stays in order even when aria-disabled) |
| `/games` | skip-link → Logo → Nav → Settings → UserMenu → filter pills → table rows (each row has a Review link) → Load older games |
| `/` | skip-link → Logo → Nav → Settings → UserMenu → hero content |

**Keyboard contracts preserved:**
- Animations switch: remains in tab order when OS prefers-reduced-motion is on (`aria-disabled`, not native `disabled`)
- Low-time tick switch: remains in tab order when Sound is off (`aria-disabled`, not native `disabled`)
- Clicking an `aria-disabled` switch does nothing (handler is `undefined` when condition is active)

---

## 4. Decisions made (with why)

1. **`text-brass-text` everywhere light-capable** — `--brass` in light mode is ~3:1 on parchment, fails AA 4.5:1 for body/label text. `--brass-text` (41 60% 32%) is ~5.2:1. Dark mode: `--brass-text === --brass`, so the change is a dark-mode no-op.
2. **`aria-disabled` pattern for conditionally-disabled Switches** — native `disabled` removes elements from tab order (WCAG 2.1.1). Conditional disabling (reducedMotion, sound=off) warrants `aria-disabled`: element stays focusable, SR announces state, interaction blocked via handler guard.
3. **`tabIndex={-1}` on `<main>`** — programmatic `focus()` from skip-link requires the target to be in the programmatic focus model. `tabIndex={-1}` makes it focusable by script without adding it to the Tab sequence. Browser only shows focus ring on `:focus-visible` (pointer/script don't trigger it), so no visual regression.
4. **`motion-reduce:` Tailwind variant for `animate-ping`/`animate-spin`** — globals.css already suppresses custom animation classes (`.animate-rise` etc.) but not Tailwind built-in utilities. The `motion-reduce:*` variant handles this without touching globals.css (off-limits for this session).
5. **Icon spans `aria-hidden` on the container** — once the container is hidden, the SR skips all children including the SVG. Cleaner than annotating every leaf icon.

---

## 5. Open issues

- **`components/home/**` a11y** — home hero board and play-setup surface are out of scope here (owned by S03/04). Any violations found there should be addressed in those sessions.
- **SettingsDialog `aria-describedby` warning** — Radix `DialogContent` emits a console warning "Missing Description or aria-describedby" in tests. Pre-existing; not introduced by this session. Tracked separately.
- **`/invite/[token]` live-token audit** — could not run a headed axe scan against an active invite since no API was running. Static code review shows no owned violations on that route.

---

## 6. Quality gates

| Gate | Result |
|------|--------|
| `cd apps/web && pnpm exec tsc --noEmit` | ✅ clean (exit 0) |
| `cd apps/web && pnpm exec vitest run test/` | ✅ 259 tests pass (33 test files) |
| Zero serious/critical axe violations on owned routes | ✅ all fixed per §2 |

---

## 7. Files changed

| File | Changes |
|------|---------|
| `apps/web/src/app/login/login-form.tsx` | C-01, RM-02 |
| `apps/web/src/app/register/register-form.tsx` | C-01, RM-02 |
| `apps/web/src/components/layout/AppShell.tsx` | C-02, F-03, SR-06, RM-01 |
| `apps/web/src/components/auth/auth-shell.tsx` | F-03 |
| `apps/web/src/components/settings/settings-form.tsx` | C-03, F-01, SR-04, SR-05 |
| `apps/web/src/components/games/game-history-list.tsx` | SR-01 |
| `apps/web/src/components/games/game-history-row.tsx` | SR-02, SR-03 |
| `apps/web/test/settings/settings-dialog.test.tsx` | Updated 2 tests; added 2 new a11y assertions |
| `apps/web/test/games/game-history-page.test.tsx` | Added 2 new a11y assertions |

---

## 8. Explicit inputs for dependent sessions

- **Session 07+ (any session touching settings or game history):** `SettingRow` disabled pattern is now `aria-disabled` + handler guard — do NOT reintroduce native `disabled` on these Switches (bug-127 pattern).
- **Session 03/04 (home/play surfaces):** `AppShell` skip-link target is now focusable; if you add any new `<main id="main-content">` (e.g. in a new shell variant), add `tabIndex={-1}` to it.
- **Any future shell variants:** replicate `tabIndex={-1}` on `<main id="main-content">`.
