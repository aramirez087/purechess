import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';
import { playTwoPlies } from '../helpers/game-helpers';

test.describe('Game ending paths', () => {
  test('resign: Alice resigns, both see result overlay', async ({
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
    // Wait for Bob's board too: the game-over is delivered over WS, so Bob must
    // be subscribed to the room before Alice resigns or he misses the push.
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    // Resign only exists past the abort window (ply >= 2).
    await playTwoPlies(alicePage, bobPage);

    // Resign button triggers directly — no confirm dialog exists in this implementation
    await alicePage.getByRole('button', { name: /resign/i }).click();

    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
  });

  // Draw offers are covered in draw-offer.spec.ts.
});
