# Session 04 Handoff — Authentication

## What Was Built

### Auth Module (`apps/api/src/auth/`)

**Core services:**
- `password.service.ts` — argon2id wrappers: `hashPassword(plain)`, `verifyPassword(plain, hash)`. Cost params: timeCost=3, memoryCost=65536, parallelism=1.
- `sessions.service.ts` — session lifecycle over Prisma `Session` table. Token is `base64url(randomBytes(32))`, stored as `HMAC-SHA256(SESSION_SECRET, token)` hex. Sliding window: sessions near 7-day expiry are extended to 30 days on lookup.

**Guards:**
- `guards/session-auth.guard.ts` — `SessionAuthGuard`: reads `purechess_session` cookie, looks up session, attaches `req.user`, throws 401 if invalid.
- `guards/optional-session-auth.guard.ts` — `OptionalSessionAuthGuard`: same but no throw on missing session.
- `guards/admin.guard.ts` — `AdminGuard`: requires `req.user.isAdmin`, throws 403.

**Decorators:**
- `decorators/current-user.decorator.ts` — `@CurrentUser()` extracts `req.user`.
- `decorators/current-user-id.decorator.ts` — `@CurrentUserId()` extracts `req.user?.id`.

**OAuth strategies:**
- `strategies/google-oauth.strategy.ts` — `GoogleOAuthStrategy` using `passport-google-oauth20`.
- `strategies/apple-oauth.strategy.ts` — `AppleOAuthStrategy` using `passport-apple`. Logs a startup warning when `OAUTH_APPLE_TEAM_ID` is blank (graceful degradation).

**DTOs (`auth/dto/`):**
- `register.dto.ts` — email, username (3-20 chars, `[a-zA-Z0-9_-]`, no leading/trailing separators, reserved names blocked), password (min 8, must have uppercase + number).
- `login.dto.ts` — `emailOrUsername`, `password`.
- `password-reset-request.dto.ts` — `email`.
- `password-reset-confirm.dto.ts` — `token`, `newPassword`.

**AuthService (`auth.service.ts`):**
- `register(dto, ip?, ua?)` — duplicate email/username → 409, reserved username → 400, creates User + Ratings for all 3 categories + session.
- `login(dto, ip?, ua?)` — looks up by email (if contains `@`) or username; argon2 verify; creates session.
- `logout(token?)` — revokes session; no-op if undefined.
- `requestPasswordReset(email)` — always returns void (no enumeration); creates `PasswordResetToken` with 1h expiry; logs link to stdout in dev.
- `confirmPasswordReset(token, newPassword)` — SHA-256 lookup, marks `usedAt`, updates `passwordHash`.
- `handleOAuth(provider, providerUserId, email, ip?, ua?)` — finds or creates User+OAuthAccount; creates session.
- `setCookie(res, token, expiresAt)` / `clearCookie(res)` — sets/clears `purechess_session` cookie (httpOnly, sameSite=lax, secure in prod).

**AuthController (`auth.controller.ts`):** All endpoints under `@Controller('auth')`:
- `POST /api/auth/register` — 201, throttled 5/min
- `POST /api/auth/login` — 200, throttled 5/min
- `POST /api/auth/logout` — 200, `OptionalSessionAuthGuard`
- `GET /api/auth/me` — 200 with SafeUser, `SessionAuthGuard`
- `POST /api/auth/password-reset/request` — 200, throttled 1/5min
- `POST /api/auth/password-reset/confirm` — 200
- `GET /api/auth/oauth/google` + `GET /api/auth/oauth/google/callback`
- `GET /api/auth/oauth/apple` + `GET /api/auth/oauth/apple/callback`

**AuthModule (`auth.module.ts`):** Imports `PassportModule`, provides all above providers, exports `AuthService`, `SessionsService`, `SessionAuthGuard`, `OptionalSessionAuthGuard`, `AdminGuard`.

### Infrastructure Changes

- `apps/api/src/main.ts` — added `app.use(cookieParser())` and `app.setGlobalPrefix('api')`.
- `apps/api/src/app.module.ts` — added `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])`.
- `apps/api/src/config/env.config.ts` — replaced `JWT_SECRET`/`JWT_EXPIRY` with `SESSION_SECRET` (min 32 chars required), added OAuth callback URLs and Apple OAuth vars.
- `.env.example` — added `SESSION_SECRET`, `OAUTH_GOOGLE_CALLBACK_URL`, `OAUTH_APPLE_TEAM_ID`, `OAUTH_APPLE_KEY_ID`, `OAUTH_APPLE_PRIVATE_KEY`, `OAUTH_APPLE_CALLBACK_URL`.
- `apps/api/package.json` — added: `argon2`, `@nestjs/passport`, `passport`, `passport-google-oauth20`, `passport-apple`, `@nestjs/throttler`, `cookie-parser`; dev: `@types/passport`, `@types/passport-google-oauth20`, `@types/cookie-parser`, `@types/supertest`, `jest`, `supertest`, `ts-jest`.
- `pnpm-workspace.yaml` — approved `argon2` build scripts.
- `apps/api/prisma/seed.ts` — migrated from `bcryptjs` to `argon2` for seed user password hashing.
- `apps/api/src/types/passport-apple.d.ts` — hand-authored type declarations for `passport-apple` (no `@types` package available).

### Shared Package Changes

- `packages/shared/src/auth.ts` — new: `SafeUser`, `AuthResponse`.
- `packages/shared/src/dto/auth.dto.ts` — replaced JWT-era `AuthResponseDto` with `PasswordResetRequestDto`, `PasswordResetConfirmDto`; updated `LoginDto.emailOrUsername`.
- `packages/shared/src/index.ts` — added `export * from './auth.js'`.

### Tests (`apps/api/test/auth/`)

- `sessions.service.spec.ts` — createSession, lookupSession (valid, expired, tampered, sliding window), revokeSession. 8 tests.
- `auth.service.spec.ts` — register (success, duplicate email, duplicate username, reserved username), login (success by email, by username, wrong password, unknown user), requestPasswordReset (unknown email, known email), confirmPasswordReset (valid, invalid). 12 tests.
- `auth.controller.spec.ts` — register (201, 400 invalid), login (200), logout (200), /me (200 with cookie, 401 without), password-reset/request (200), password-reset/confirm (200). 6 tests.

## Verification Evidence

```
pnpm -r typecheck  → 0 errors (shared, api, web)
pnpm -r lint       → 0 errors (shared, api, web)
npx jest --testPathPattern="auth"
  → 3 suites, 26 tests, 0 failures
```

## Open Issues / Known Gaps

- **Apple OAuth graceful degradation:** `AppleOAuthStrategy` is registered in `AuthModule` regardless of env vars. If `OAUTH_APPLE_TEAM_ID` is blank, the strategy logs a warning but NestJS/passport will error when the `/api/auth/oauth/apple` route is hit. Future session can implement conditional factory registration in `AuthModule` if needed.
- **Email delivery:** `requestPasswordReset` logs the reset URL to stdout in all environments. Production email delivery (SES/Resend/Postmark) is a future session — the hook is a single `Logger.log()` call to replace.
- **OAuth callback redirect:** POST-style Apple OAuth callbacks may need `POST` method on the callback route. Currently `GET` is used — needs verification with real Apple credentials.
- **Session cleanup:** No TTL-based session cleanup job. Expired sessions accumulate in DB. A periodic cleanup job is out of scope for this session.
- **bcryptjs** remains in `package.json` as a dependency (it was used in seed.ts). It's no longer used anywhere but removing it is low priority.

## Inputs Downstream Sessions Can Rely On

### Guards and Decorators

```typescript
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { OptionalSessionAuthGuard } from '../auth/guards/optional-session-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
```

`AuthModule` is `@Global()` — no: guards must be injected from `AuthModule` exports. Import `AuthModule` in any module that needs `SessionAuthGuard`.

### Cookie Name
`purechess_session` — the WebSocket gateway (session 06) should read this cookie in `handleConnection` by parsing the `Cookie` header.

### AuthResult Internal Type
```typescript
import { AuthResult } from '../auth/auth.service';
// { user: SafeUser; sessionToken: string; sessionExpiresAt: Date }
```

### Shared Types
```typescript
import { SafeUser, AuthResponse } from '@purechess/shared';
```

### Env Keys Added This Session
- `SESSION_SECRET` — min 32 chars, required. Used for HMAC session token storage.
- `OAUTH_GOOGLE_CALLBACK_URL` — default `http://localhost:4000/api/auth/oauth/google/callback`
- `OAUTH_APPLE_TEAM_ID`, `OAUTH_APPLE_KEY_ID`, `OAUTH_APPLE_PRIVATE_KEY`, `OAUTH_APPLE_CALLBACK_URL` — optional; Apple OAuth disabled when `OAUTH_APPLE_TEAM_ID` blank.

### JWT_SECRET Removal
`JWT_SECRET` and `JWT_EXPIRY` are removed from `env.config.ts`. Downstream sessions must NOT add JWT auth — all auth is session-cookie based.

### All API Routes Under `/api` Prefix
`app.setGlobalPrefix('api')` is set in `main.ts`. All controllers must use short names: `@Controller('auth')`, `@Controller('games')`, etc.
