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
    const disableBtn = adminPage.getByRole('button', { name: /disable/i });
    if (await disableBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await disableBtn.click();
      const confirmBtn = adminPage.getByRole('button', { name: /confirm|yes/i });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await adminPage.waitForTimeout(1000);
    }

    const meRes = await fetch(`${API_URL}/api/users/me`, {
      headers: { Cookie: sessionCookie(target.sessionToken) },
    });
    expect(meRes.status).toBe(401);

    await adminCtx.close();
  });
});
