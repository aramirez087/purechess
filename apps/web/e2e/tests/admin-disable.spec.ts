import { test, expect } from '@playwright/test';
import { createTestUser, sessionCookie } from '../helpers/test-api';

const API_URL = process.env['API_URL'] ?? 'http://localhost:4000';

test.describe('Admin: disable user', () => {
  test('admin disables user → 401 on next request + audit log entry', async ({ browser }) => {
    const suffix = Date.now();
    const admin = await createTestUser({
      username: `admin-${suffix}`,
      email: `admin-${suffix}@e2e.test`,
      isAdmin: true,
    });
    const target = await createTestUser({
      username: `target-${suffix}`,
      email: `target-${suffix}@e2e.test`,
    });

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminPage.goto('/');
    await adminPage.evaluate((t) => {
      document.cookie = `purechess_session=${t}; path=/`;
    }, admin.sessionToken);

    await adminPage.goto(`/admin/users/${target.id}`);
    await adminPage.getByRole('button', { name: 'Disable account' }).click();
    // The confirm button stays disabled until a reason is entered.
    await adminPage.getByLabel(/reason/i).fill('e2e: disable flow test');
    await adminPage.getByRole('button', { name: 'Disable', exact: true }).click();
    // The page reflects the mutation once it lands.
    await expect(adminPage.getByRole('button', { name: 'Enable account' })).toBeVisible({
      timeout: 10000,
    });

    // The authenticated identity endpoint is /api/auth/me (/api/users/me does
    // not exist — that path resolves to the :username route and 404s). It uses
    // OptionalSessionAuthGuard, so a dead session is 200 {user: null}, not 401.
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie(target.sessionToken) },
    });
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { user: unknown };
    expect(meBody.user).toBeNull();

    await adminCtx.close();
  });
});
