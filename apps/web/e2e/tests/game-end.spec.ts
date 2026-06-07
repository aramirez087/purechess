import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Game ending paths', () => {
  test('resign: Alice resigns, Bob sees win overlay', async ({
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

    await alicePage.goto(`/games/${game.id}`);
    await bobPage.goto(`/games/${game.id}`);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await alicePage.getByRole('button', { name: /resign/i }).click();
    await alicePage.getByRole('button', { name: /confirm|yes/i }).click();

    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
  });

  test('draw offer: Alice offers, Bob accepts, both see draw overlay', async ({
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

    await alicePage.goto(`/games/${game.id}`);
    await bobPage.goto(`/games/${game.id}`);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await alicePage.getByRole('button', { name: /draw/i }).click();

    await expect(bobPage.locator('[data-testid="draw-offer"]')).toBeVisible({ timeout: 10000 });
    await bobPage.getByRole('button', { name: /accept/i }).click();

    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
  });
});
