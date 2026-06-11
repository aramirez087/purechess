import { test, expect } from '../fixtures/auth.fixture';
import { waitForGameUrl, extractGameId } from '../helpers/game-helpers';
import type { Page } from '@playwright/test';

/**
 * Quick Match: two players queue the default pool (3+0 rated) and are paired
 * into the same active game. Defaults both at rating 1500, well inside the
 * initial 200-point window.
 */
test.describe('Quick Match', () => {
  async function openQuickMatch(page: Page): Promise<void> {
    await page.goto('/play');
    await page.getByRole('button', { name: /quick match/i }).click();
    await expect(page.getByRole('button', { name: /find opponent/i })).toBeVisible({
      timeout: 10000,
    });
  }

  test('two players queue 3+0 rated and land in the same game', async ({
    aliceContext,
    bobContext,
  }) => {
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await openQuickMatch(alicePage);
    await openQuickMatch(bobPage);

    await alicePage.getByRole('button', { name: /find opponent/i }).click();
    await expect(alicePage.getByText(/finding an opponent/i)).toBeVisible({ timeout: 10000 });

    await bobPage.getByRole('button', { name: /find opponent/i }).click();

    const aliceUrl = await waitForGameUrl(alicePage);
    const bobUrl = await waitForGameUrl(bobPage);
    expect(extractGameId(aliceUrl)).toBe(extractGameId(bobUrl));

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });

  test('cancel search returns to the setup card', async ({ aliceContext }) => {
    const alicePage = await aliceContext.newPage();
    await openQuickMatch(alicePage);

    await alicePage.getByRole('button', { name: /find opponent/i }).click();
    await expect(alicePage.getByText(/finding an opponent/i)).toBeVisible({ timeout: 10000 });

    await alicePage.getByRole('button', { name: /cancel search/i }).click();
    await expect(alicePage.getByRole('button', { name: /find opponent/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
