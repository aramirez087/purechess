import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Game review', () => {
  test('step through moves, copy PGN', async ({ alice, bob, aliceContext }) => {
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'completed',
    });

    const page = await aliceContext.newPage();
    await page.goto(`/games/${game.id}`);

    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    const copyBtn = page.getByRole('button', { name: /copy pgn/i });
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
    }
  });
});
