import { test, expect } from '@playwright/test';

let counter = 0;

function uniqueCredentials() {
  const slug = `${Date.now()}${++counter}`.replace(/[^a-z0-9]/gi, '').slice(-10);
  return {
    email: `e2e-${slug}@e2e.test`,
    username: `e2e${slug}`,
    password: 'E2eTest1!',
  };
}

test.describe('Email registration', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('@smoke register, login, session persists, and /play loads', async ({
    page,
    context,
  }) => {
    const creds = uniqueCredentials();

    await page.goto('/register?return=/play');
    await page.getByLabel('Email').fill(creds.email);
    await page.getByLabel('Username').fill(creds.username);
    await page.getByLabel('Password', { exact: true }).fill(creds.password);

    const registerDone = page.waitForResponse(
      (res) => res.url().includes('/api/auth/register') && res.status() === 201,
    );
    await page.getByRole('button', { name: /create account/i }).click();
    await registerDone;
    await page.waitForURL(/\/play/, { timeout: 15000 });

    await expect
      .poll(async () => {
        const me = await page.evaluate(async () => {
          const res = await fetch('/api/auth/me', { credentials: 'include' });
          return res.json() as Promise<{ user: { username: string } | null }>;
        });
        return me.user?.username;
      })
      .toBe(creds.username);

    await expect(page.getByRole('heading', { name: /ready to play/i })).toBeVisible();

    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    });
    await context.clearCookies();

    await page.goto('/login?return=/play');
    await page.getByLabel('Email or username').fill(creds.email);
    await page.getByLabel('Password', { exact: true }).fill(creds.password);

    const loginDone = page.waitForResponse(
      (res) => res.url().includes('/api/auth/login') && res.status() === 200,
    );
    await page.getByRole('button', { name: /sign in/i }).click();
    await loginDone;
    await page.waitForURL(/\/play/, { timeout: 15000 });

    const me = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.json() as Promise<{ user: { username: string } | null }>;
    });
    expect(me.user?.username).toBe(creds.username);
    await expect(page.getByRole('link', { name: /find opponent/i })).toBeVisible();
  });
});