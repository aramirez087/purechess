import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';
import { makeMove } from '../helpers/game-helpers';

/**
 * PvP abort: available to either player while the game has fewer than 2
 * plies. Aborted games end with no result and no rating change.
 */
test.describe('PvP abort', () => {
  test('Alice aborts before move 2, both see the aborted state', async ({
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
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await alicePage.getByRole('button', { name: /abort/i }).click();

    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(alicePage.locator('[data-testid="game-result"]')).toContainText(/aborted/i);
    await expect(bobPage.locator('[data-testid="game-result"]')).toContainText(/aborted/i);
  });

  test('Abort disappears once both sides have moved', async ({
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
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await expect(alicePage.getByRole('button', { name: /abort/i })).toBeVisible({
      timeout: 10000,
    });

    await makeMove(alicePage, 'e2', 'e4');
    await expect(bobPage.locator('[data-square="e4"] img')).toBeVisible({ timeout: 10000 });
    await makeMove(bobPage, 'e7', 'e5');
    await expect(alicePage.locator('[data-square="e5"] img')).toBeVisible({ timeout: 10000 });

    // Past the abort window the footer switches to Draw + Resign.
    await expect(alicePage.getByRole('button', { name: /^draw$/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(alicePage.getByRole('button', { name: /abort/i })).not.toBeVisible();
  });
});
