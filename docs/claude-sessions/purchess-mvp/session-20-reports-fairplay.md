---
depends_on: [08, 19]
touches:
  - "apps/api/src/reports/**"
  - "apps/api/src/reports/reports.module.ts"
  - "apps/api/src/reports/reports.service.ts"
  - "apps/api/src/reports/reports.controller.ts"
  - "apps/api/src/reports/dto/**"
  - "apps/api/test/reports/**"
  - "apps/web/src/components/game/report-button.tsx"
  - "apps/web/src/components/game/report-dialog.tsx"
  - "apps/web/src/app/admin/reports/**"
  - "apps/web/src/app/admin/reports/page.tsx"
  - "apps/web/src/app/admin/reports/[id]/page.tsx"
  - "apps/web/src/components/admin/reports-table.tsx"
  - "apps/web/src/components/admin/report-detail.tsx"
  - "apps/web/src/components/admin/fairplay-signals.tsx"
  - "apps/web/src/hooks/use-report.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 20: Reports & Fair Play

## Mission

Ship the user-facing "Report" button on completed games and the admin-side report review page. Also surface the basic fair-play signals (collected in Session 11) in the admin view of a user or game so a human can spot obvious abuse.

No automated bans. No full engine correlation. The system is a paper trail that lets a human moderator act.

## Tasks

1. **Backend** (`apps/api/src/reports/`):
   - `reports.module.ts`, `reports.service.ts`, `reports.controller.ts`.
   - `dto/` — `CreateReportDto`, `UpdateReportStatusDto`.
2. **REST endpoints**:
   - `POST /api/reports` (auth required) — body: `{ reportedUserId, gameId, reason, notes? }`. Reasons: `cheating`, `abuse`, `stalking`, `multi_account`, `other`. One report per (reporter, game) — duplicate submission is a no-op.
   - `GET /api/reports/me` — reports the current user has filed.
   - `GET /api/admin/reports` — paginated, supports `?status=open|reviewed|dismissed&reportedUserId=`.
   - `GET /api/admin/reports/:id` — full report detail with game summary, both players' last 20 games, fair-play signals.
   - `PATCH /api/admin/reports/:id` — body: `{ status, notes? }`. Sets reviewedAt and reviewedByUserId. Audit logged.
3. **Report button on game review** (`report-button.tsx`):
   - Visible on `/games/[gameId]` and the in-game game-over dialog.
   - Disabled if the current user is one of the two players AND wants to report themselves (which doesn't make sense) — instead, hide the report button for the player being reported; show only "Report opponent".
   - Click opens a `report-dialog.tsx`:
     - Reason radio group.
     - Optional notes textarea.
     - Submit.
4. **Admin reports page** (`/admin/reports`):
   - List: reporter, reported user, game link, reason, status, created, reviewed-by.
   - Click → detail page with the report, the game (review-style), the reported user's profile + last 20 games, and the fair-play signals.
   - "Mark reviewed" / "Dismiss" actions.
5. **Fair-play signals panel** (`fairplay-signals.tsx`):
   - Renders the signals collected in Session 11 for a given user or game.
   - Each signal shown as a row: type, score (0-1, color-coded), payload (e.g., "low variance σ = 0.04s over 20 moves").
   - **No automated verdict.** The panel is informational. The human decides.
6. **Admin moderation link from signals**:
   - If a user has signals that look suspicious (score > 0.7), the admin user-detail page shows a "Review signals" callout.
7. **Tests**:
   - Backend: create report, duplicate is no-op, admin endpoints require admin, status transitions work, audit logged.
   - Frontend: report dialog submits, admin list filters, status update.
8. **Verification**:
   - Manual: file a report from one user against another, see it appear in admin, mark reviewed.

## Deliverables

- User-facing report flow.
- Admin reports queue and detail.
- Fair-play signals panel for moderation context.
- Audit trail on every status change.

## Notes for Downstream Sessions

- Fair-play signals are read-only from the admin side. Mutating them or building automated actions is out of scope.
- The "Reported user" surface in admin reuses the user-detail page from Session 19.
- Multiple reports against the same user in the same game are merged into one report with a count — implement this in the controller, not the UI.
- No email notifications to the reported user. The platform is anonymous-by-default on the chess side; reporting is quiet.

## Out of scope (defer)

- Automated cheat detection.
- Engine correlation (matching moves to Stockfish).
- Public "fair play" badge.
- Appeals process.
