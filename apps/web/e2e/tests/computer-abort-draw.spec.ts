import { test, expect } from '../fixtures/auth.fixture';
import { createTestComputerGame } from '../helpers/test-api';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Computer-game abort + draw-claim controls (wired to the long-existing
 * /computer-games/:id/abort and /draw endpoints).
 */
test.describe('Computer game abort and draw claim', () => {
  test('abort before moving ends the game with an aborted overlay', async ({
    alice,
    aliceContext,
  }) => {
    const game = await createTestComputerGame({
      sessionToken: alice.sessionToken,
      fen: START_FEN,
      color: 'white',
      level: 1,
      timeControlSeconds: 0,
    });

    const page = await aliceContext.newPage();
    await page.goto(`/computer-game/${game.id}`);
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /abort/i }).click();

    await expect(page.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="game-result"]')).toContainText(/aborted/i);
  });

  test('after moving, Draw replaces Abort; an unfounded claim surfaces the server error', async ({
    alice,
    aliceContext,
  }) => {
    const game = await createTestComputerGame({
      sessionToken: alice.sessionToken,
      fen: START_FEN,
      color: 'white',
      level: 1,
      timeControlSeconds: 0,
    });

    const page = await aliceContext.newPage();
    await page.goto(`/computer-game/${game.id}`);
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /abort/i })).toBeVisible({ timeout: 10000 });

    // 1. e4 — the human has moved, so the abort window closes.
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    await expect(page.getByRole('button', { name: /^draw$/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /abort/i })).not.toBeVisible();

    // Wait for the bot's reply so the claim lands on the human's turn.
    await expect(page.getByRole('button', { name: /resign/i })).toBeEnabled({ timeout: 20000 });

    // Fresh game — there is no threefold/fifty-move draw to claim.
    await page.getByRole('button', { name: /^draw$/i }).click();
    await expect(page.getByText(/no draw to claim/i)).toBeVisible({ timeout: 10000 });

    // The game is still live.
    await expect(page.locator('[data-testid="game-result"]')).not.toBeVisible();
  });
});
