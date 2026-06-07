import { test, expect } from '@playwright/test';

test.describe('Anonymous casual game', () => {
  test('two anon users match and play', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto('/play');
    await page2.goto('/play');

    await page1.getByRole('button', { name: /quick match|play/i }).first().click();
    await page2.getByRole('button', { name: /quick match|play/i }).first().click();

    await expect(page1).toHaveURL(/\/games\//, { timeout: 20000 });
    await expect(page2).toHaveURL(/\/games\//, { timeout: 20000 });

    await expect(page1.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await ctx1.close();
    await ctx2.close();
  });
});
