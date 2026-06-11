import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Result overlay', () => {
  test('completed game shows overlay immediately on navigate', async ({
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
    await page.goto(`/play/${game.id}`);

    await expect(page.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
  });

  test('"View board" dismisses the overlay', async ({ alice, bob, aliceContext }) => {
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const page = await aliceContext.newPage();
    await page.goto(`/play/${game.id}`);

    await expect(page.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /view board/i }).click();

    await expect(page.locator('[data-testid="game-result"]')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible();
  });

  test('"New" link navigates to /play', async ({ alice, bob, aliceContext }) => {
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const page = await aliceContext.newPage();
    await page.goto(`/play/${game.id}`);

    await expect(page.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: /new/i }).click();

    await expect(page).toHaveURL(/\/play$/, { timeout: 10000 });
  });

  test('resign during active game shows overlay for both players', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'active',
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await alicePage.goto(`/play/${game.id}`);
    await bobPage.goto(`/play/${game.id}`);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await alicePage.getByRole('button', { name: /resign/i }).click();

    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
  });
});
