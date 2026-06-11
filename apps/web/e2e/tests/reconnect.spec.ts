import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Reconnect mid-game', () => {
  test('Alice disconnects and reconnects, board stays in sync', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'active',
      timeControlSeconds: 600,
      incrementSeconds: 0,
      category: 'rapid',
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await alicePage.goto(`/play/${game.id}`);
    await bobPage.goto(`/play/${game.id}`);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await aliceContext.setOffline(true);

    await aliceContext.setOffline(false);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });
});
