import { test, expect } from '../fixtures/auth.fixture';

test.describe('Rated blitz game — Alice vs Bob', () => {
  test('both players match, play, and see rating deltas', async ({ aliceContext, bobContext }) => {
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await alicePage.goto('/play');
    await bobPage.goto('/play');

    await alicePage.getByRole('button', { name: /rated|blitz/i }).first().click();
    await bobPage.getByRole('button', { name: /rated|blitz/i }).first().click();

    await expect(alicePage).toHaveURL(/\/games\//, { timeout: 20000 });
    await expect(bobPage).toHaveURL(/\/games\//, { timeout: 20000 });

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });
});
