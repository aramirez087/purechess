import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Game ledger navigation', () => {
  test('ledger lists completed games, clicking a row opens review', async ({
    alice,
    bob,
    aliceContext,
  }) => {
    await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
      timeControlSeconds: 180,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const page = await aliceContext.newPage();
    await page.goto('/games');

    // Wait for at least one row to appear.
    const firstRow = page.locator('[data-testid="game-row"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    // Click the row — should navigate to the game review page.
    await firstRow.click();
    await expect(page).toHaveURL(/\/games\/[a-z0-9]+/i, { timeout: 10000 });
  });

  test('category filter narrows results', async ({ alice, bob, aliceContext }) => {
    await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
      timeControlSeconds: 180,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const page = await aliceContext.newPage();
    // Filter for bullet — only have a blitz game, so expect empty.
    await page.goto('/games?category=bullet');

    await expect(page.locator('[data-testid="game-row"]')).toHaveCount(0, { timeout: 10000 });
  });

  test('Review link inside a row navigates to game review', async ({
    alice,
    bob,
    aliceContext,
  }) => {
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const page = await aliceContext.newPage();
    await page.goto('/games');

    const reviewLink = page
      .locator('[data-testid="game-row"]')
      .first()
      .getByRole('link', { name: /review/i });
    await expect(reviewLink).toBeVisible({ timeout: 10000 });
    await reviewLink.click();

    await expect(page).toHaveURL(`/games/${game.id}`, { timeout: 10000 });
  });
});
