<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the PureChess NestJS API. The existing `PosthogService` and `AnalyticsModule` were extended with `identify()` and `captureException()` methods, and `enableExceptionAutocapture: true` was added to the PostHog client constructor. Thirteen business events were instrumented across six service files, covering the full player lifecycle: account registration (email and OAuth), login, logout, password resets, computer game creation and completion, game invite flows, profile updates, and player reports. Server-side error tracking was wired into the global exception filter so all 5xx errors are automatically sent to PostHog alongside the existing Sentry integration. Environment variables `POSTHOG_API_KEY` and `POSTHOG_HOST` were written to `apps/api/.env`.

| Event | Description | File |
|---|---|---|
| `user_registered` | New user completes email/password registration | `apps/api/src/auth/auth.service.ts` |
| `user_logged_in` | User logs in with email/password credentials | `apps/api/src/auth/auth.service.ts` |
| `user_logged_out` | User explicitly logs out | `apps/api/src/auth/auth.controller.ts` |
| `oauth_authenticated` | User authenticates via Google or Apple OAuth | `apps/api/src/auth/auth.service.ts` |
| `password_reset_requested` | User requests a password reset email | `apps/api/src/auth/auth.service.ts` |
| `password_reset_completed` | User successfully resets their password | `apps/api/src/auth/auth.service.ts` |
| `computer_game_created` | User starts a new game vs the Stockfish engine | `apps/api/src/computer-games/computer-games.service.ts` |
| `computer_game_completed` | Game vs computer reaches a final result | `apps/api/src/computer-games/computer-games.service.ts` |
| `invite_created` | User creates a game invite link | `apps/api/src/invites/invites.service.ts` |
| `invite_accepted` | Second player accepts a game invite | `apps/api/src/invites/invites.service.ts` |
| `invite_cancelled` | Creator cancels a pending invite | `apps/api/src/invites/invites.service.ts` |
| `player_reported` | User submits a report against another player | `apps/api/src/reports/reports.service.ts` |
| `profile_updated` | User updates their username or avatar | `apps/api/src/users/users.service.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/209126/dashboard/1680439)
- [New Registrations Over Time](https://us.posthog.com/project/209126/insights/2q18jHHI)
- [Registration to First Game Funnel](https://us.posthog.com/project/209126/insights/fZcTpdQU)
- [Game Invite Conversion Funnel](https://us.posthog.com/project/209126/insights/gMTfvLV2)
- [Computer Game Outcomes](https://us.posthog.com/project/209126/insights/hOFBKvzx)
- [User Churn Signals](https://us.posthog.com/project/209126/insights/Jt0FL7Am)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
