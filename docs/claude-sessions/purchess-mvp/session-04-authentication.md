---
depends_on: [02]
touches:
  - "apps/api/src/auth/**"
  - "apps/api/src/auth/auth.module.ts"
  - "apps/api/src/auth/auth.controller.ts"
  - "apps/api/src/auth/auth.service.ts"
  - "apps/api/src/auth/dto/**"
  - "apps/api/src/auth/guards/**"
  - "apps/api/src/auth/strategies/**"
  - "apps/api/test/auth/**"
  - "packages/shared/src/auth.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 04: Authentication Module

## Mission

Implement the full authentication surface for Purchess: email/password registration and login, Google and Apple OAuth, server-side sessions, password recovery, and the guards/middleware that protect routes. This is the front door — every other backend module depends on `AuthGuard` and `CurrentUser` decorator.

## Tasks

1. **Password hashing** using `argon2` (preferred) or `bcrypt` with cost ≥ 12. Expose `hashPassword` and `verifyPassword` helpers.
2. **Session model**:
   - Server-side sessions stored in `Session` table (per Session 02 schema).
   - Session id is a 32-byte random token, base64url encoded. Stored in DB hashed.
   - Cookie name: `purchess_session`, httpOnly, secure in prod, sameSite=Lax, 30-day expiry sliding.
   - `SessionsService` handles create / lookup / refresh / revoke.
3. **Auth module structure** (`apps/api/src/auth/`):
   - `auth.module.ts` wires everything.
   - `auth.service.ts` — register, login, logout, requestPasswordReset, confirmPasswordReset.
   - `auth.controller.ts` — REST endpoints (see below).
   - `dto/` — class-validator DTOs.
   - `guards/` — `SessionAuthGuard`, `OptionalSessionAuthGuard`, `AdminGuard`.
   - `decorators/` — `@CurrentUser()`, `@CurrentUserId()`.
   - `strategies/` — `GoogleOAuthStrategy`, `AppleOAuthStrategy` (passport strategies).
4. **REST endpoints** (all under `/api/auth`):
   - `POST /api/auth/register` — body: `{ email, username, password }`. Creates user, hashes password, creates session, sets cookie, returns `{ user, sessionExpiresAt }`.
   - `POST /api/auth/login` — body: `{ emailOrUsername, password }`.
   - `POST /api/auth/logout` — revokes session, clears cookie. No-op if anonymous.
   - `GET /api/auth/me` — returns current user or 401.
   - `POST /api/auth/password-reset/request` — body: `{ email }`. Always returns 200 (no enumeration). If email matches, generates token, stores hash, sends email (or logs link in dev).
   - `POST /api/auth/password-reset/confirm` — body: `{ token, newPassword }`.
   - `GET /api/auth/oauth/google` — passport redirect.
   - `GET /api/auth/oauth/google/callback` — passport callback; on success, creates session and redirects to web app.
   - `GET /api/auth/oauth/apple` + callback — same shape.
5. **Username rules** (validate at registration):
   - 3-20 chars, `[a-zA-Z0-9_-]`, no leading/trailing separators, reserved names blocked (`admin`, `purchess`, `system`, ...).
   - Case-insensitive uniqueness via `citext` column.
6. **Rate limiting** on `/api/auth/*` using `@nestjs/throttler`:
   - 5 req / min on login + register.
   - 1 req / 5 min on password-reset/request.
7. **OAuth implementation**:
   - Google: `passport-google-oauth20`. Use `id_token` validation if possible, otherwise profile + email.
   - Apple: `passport-apple`. Use Sign in with Apple JWT verification.
   - On first OAuth login: create `User` (no password) and `OAuthAccount`. On subsequent: link by (provider, providerUserId).
8. **Guards**:
   - `SessionAuthGuard` reads cookie, looks up session, attaches `req.user`. Throws 401 if invalid.
   - `OptionalSessionAuthGuard` does the same but doesn't throw on missing.
   - `AdminGuard` requires `req.user.isAdmin`.
9. **Shared types** (`packages/shared/src/auth.ts`):
   - `SafeUser` (id, username, avatarUrl, isAdmin, createdAt — no email, no hash).
   - `AuthResponse` (`{ user: SafeUser; sessionExpiresAt: string }`).
10. **Tests** (`apps/api/test/auth/`):
    - Register: success, duplicate email, duplicate username (case variants), weak password, invalid username.
    - Login: success, wrong password, unknown user.
    - Session: cookie set, /me returns user, logout clears session.
    - Password reset: request always returns 200; token works once and only once.
    - OAuth: stub strategies and verify session creation.
    - Guards: 401 when no session, 200 with valid session, admin guard rejects non-admin.
11. **Verification**:
    - All endpoints respond as specified.
    - Cookie attributes correct in dev and prod modes.
    - Argon2 hashes verified in tests.

## Deliverables

- `AuthModule` fully wired into the API's `AppModule`.
- All REST endpoints live and tested.
- Session-cookie based auth usable from web and from WebSocket handshake (see Session 06).
- Shared `SafeUser` and `AuthResponse` types.
- `SESSION_SECRET` env var documented in `.env.example`.

## Notes for Downstream Sessions

- Use `@CurrentUser()` to read the authed user in controllers/services — never trust headers from the client.
- The WebSocket gateway (Session 06) will share this cookie via `withCredentials` on the client and read the same session in `handleConnection`.
- Anonymous users (no session) are still allowed for casual play — wrap endpoints in `OptionalSessionAuthGuard` where applicable.
- The `Session` model is the single source of truth for "is this user logged in". Do not duplicate state in Redis for sessions — keep Redis for game state only.
- Email delivery: in dev, log the reset link to the API stdout. In prod, wire SES/Resend/Postmark in a later session (out of MVP scope but the hook should be a single service).
