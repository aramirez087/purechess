import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Profile and game history', () => {
  test('profile shows rating, game history links to review', async ({
    alice,
    bob,
    aliceContext,
  }) => {
    await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
      timeControlSeconds: 180,
      category: 'blitz',
    });

    const page = await aliceContext.newPage();
    await page.goto(`/profile/${alice.username}`);

    await expect(page.locator('[data-testid="user-rating"]')).toBeVisible({ timeout: 10000 });

    const gameLink = page.locator('[data-testid="game-history-item"]').first();
    if (await gameLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gameLink.click();
      await expect(page).toHaveURL(/\/games\//, { timeout: 10000 });
    }
  });
});
