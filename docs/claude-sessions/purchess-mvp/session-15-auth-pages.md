---
depends_on: [03, 04]
touches:
  - "apps/web/src/app/(auth)/**"
  - "apps/web/src/app/(auth)/login/page.tsx"
  - "apps/web/src/app/(auth)/register/page.tsx"
  - "apps/web/src/app/(auth)/forgot-password/page.tsx"
  - "apps/web/src/app/(auth)/reset-password/page.tsx"
  - "apps/web/src/components/auth/**"
  - "apps/web/src/components/auth/login-form.tsx"
  - "apps/web/src/components/auth/register-form.tsx"
  - "apps/web/src/components/auth/oauth-buttons.tsx"
  - "apps/web/src/components/auth/forgot-password-form.tsx"
  - "apps/web/src/components/auth/reset-password-form.tsx"
  - "apps/web/src/components/auth/auth-shell.tsx"
  - "apps/web/src/hooks/use-auth.ts"
  - "apps/web/src/stores/auth-store.ts"
  - "apps/web/src/lib/api-client.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 15: Auth Pages

## Mission

Ship the user-facing auth flows: register, login, OAuth, and password recovery. The pages must feel like part of the same calm aesthetic as the rest of the app — no marketing fluff, no upsells, just a clean form that gets out of the way.

## Tasks

1. **API client** (`lib/api-client.ts`):
   - Thin `fetch` wrapper that:
     - Includes `credentials: 'include'` on every request.
     - Base URL from `NEXT_PUBLIC_API_URL`.
     - Typed `post`, `get`, `patch`, `del` that throw on non-2xx with the server's error shape.
     - Hooks: `useApiQuery`, `useApiMutation` (TanStack Query).
2. **Auth store** (`auth-store.ts`):
   - Zustand: `{ user: SafeUser | null, status: 'loading' | 'authed' | 'anon', login, logout, refresh }`.
   - On app mount, calls `GET /api/auth/me` to bootstrap.
3. **Auth hook** (`use-auth.ts`):
   - Returns `{ user, status, login, register, logout, requestPasswordReset, confirmPasswordReset, loginWithOAuth }`.
   - Handles session-expired by redirecting to `/login?return=<current>`.
4. **Auth shell** (`auth-shell.tsx`):
   - Centered card, max-width 400px.
   - Wordmark logo on top.
   - Single-column form layout.
   - Footer link: "Need an account? Register" or "Have an account? Log in".
5. **Register page** (`/register`):
   - Fields: email, username, password, confirm password.
   - Client-side validation:
     - Email format.
     - Username: 3-20 chars, `[a-zA-Z0-9_-]`, no leading/trailing separators.
     - Password: ≥ 8 chars, at least one letter and one number.
   - Submit → `POST /api/auth/register`. On success, redirect to `?return=` or `/play`.
   - OAuth buttons below: Continue with Google, Continue with Apple.
6. **Login page** (`/login`):
   - Fields: email or username, password.
   - "Forgot password?" link.
   - Submit → `POST /api/auth/login`. On success, redirect.
   - OAuth buttons below.
7. **OAuth buttons** (`oauth-buttons.tsx`):
   - Two large buttons with provider logo and "Continue with Google" / "Continue with Apple".
   - On click, navigate to `/api/auth/oauth/google` (full-page redirect) or `/api/auth/oauth/apple`.
   - Server redirects back to the app post-auth.
   - The web app handles the redirect by checking the session on mount.
8. **Forgot password page** (`/forgot-password`):
   - Single field: email.
   - Submit → `POST /api/auth/password-reset/request`.
   - Success message is always neutral ("If an account exists, you'll receive an email"). In dev, surface the reset link from the server response if present.
9. **Reset password page** (`/reset-password?token=...`):
   - Fields: new password, confirm password.
   - Submit → `POST /api/auth/password-reset/confirm`.
   - On success, redirect to `/login` with a "Password updated" toast.
10. **Auth-required gating**:
    - A `<RequireAuth>` component used by other pages (e.g., `/play` for rated, `/profile/me`, `/admin`).
    - If anonymous, redirect to `/login?return=<path>`.
    - After login, redirect to the return URL.
11. **Logout**:
    - In the user menu (header), call `POST /api/auth/logout`, then refresh.
    - No confirmation modal — it's a single click.
12. **Forms**:
    - Use shadcn `Input`, `Label`, `Button`. No custom form library needed (controlled inputs with React Hook Form is overkill for 2-3 fields per form; use plain controlled state).
    - For ≥ 4 fields, use `react-hook-form` + `zod` resolver. Otherwise plain state.
13. **Validation feedback**:
    - Inline field errors in `text-destructive` text below the input.
    - Top-of-form alert for server errors (e.g., "Username already taken").
    - Disable submit while pending; show inline spinner.
14. **Accessibility**:
    - Labels associated with inputs (`htmlFor` / `id`).
    - `aria-invalid` and `aria-describedby` on errored fields.
    - Focus moves to first error on submit failure.
    - All buttons keyboard reachable; Tab order matches visual order.
15. **Tests**:
    - Form validation: client-side rules (Vitest).
    - Submit success: mock API, assert redirect.
    - Submit failure: assert error message displayed.
    - OAuth redirect: assert window navigation initiated with correct URL.
    - `RequireAuth` redirects anonymous user to login with `return` param.
16. **Verification**:
    - Lighthouse a11y ≥ 95 on all auth pages.
    - Manual: full register → login → logout → password reset flow on desktop and mobile.

## Deliverables

- `/login`, `/register`, `/forgot-password`, `/reset-password` pages.
- `<RequireAuth>` component usable by other pages.
- `auth-store` and `use-auth` consumed by header and other gated pages.
- OAuth wired to backend.

## Notes for Downstream Sessions

- The `use-auth` hook is the canonical way to know the current user. The header reads from it; Session 17 (profile) reads from it; Session 19 (admin) guards on it.
- Don't store tokens in localStorage. Session cookies are httpOnly — the client never sees them.
- The `return` URL is validated against the same origin; reject anything cross-origin.
- Don't add captcha or email verification in MVP. The PRD doesn't ask for it and it adds friction.
- Apple Sign-In requires a developer account in prod. For local dev, stub the strategy; the redirect URL chain still works.
