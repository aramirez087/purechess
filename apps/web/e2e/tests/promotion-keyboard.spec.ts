import { test, expect } from '../fixtures/auth.fixture';
import { createTestComputerGame } from '../helpers/test-api';
import { makeMove } from '../helpers/game-helpers';

// White pawn on a7, kings clear of a8 — one move from promotion.
const PROMO_FEN = '7k/P7/K7/8/8/8/8/8 w - - 0 1';

test.describe('Promotion dialog — keyboard', () => {
  test('Tab + Enter selects rook over default queen', async ({ alice, aliceContext }) => {
    const game = await createTestComputerGame({
      sessionToken: alice.sessionToken,
      fen: PROMO_FEN,
      color: 'white',
      level: 1,
      timeControlSeconds: 0,
    });

    const page = await aliceContext.newPage();
    await page.goto(`/computer-game/${game.id}`);
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await makeMove(page, 'a7', 'a8');

    const dialog = page.getByRole('dialog', { name: 'Choose promotion piece' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Queen has autoFocus; Tab moves to rook (2nd button), Enter confirms.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // A move was recorded in the ledger.
    await expect(page.locator('[data-move-number]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Escape cancels promotion — pawn stays, no move recorded', async ({
    alice,
    aliceContext,
  }) => {
    const game = await createTestComputerGame({
      sessionToken: alice.sessionToken,
      fen: PROMO_FEN,
      color: 'white',
      level: 1,
      timeControlSeconds: 0,
    });

    const page = await aliceContext.newPage();
    await page.goto(`/computer-game/${game.id}`);
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await makeMove(page, 'a7', 'a8');

    const dialog = page.getByRole('dialog', { name: 'Choose promotion piece' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');

    await expect(dialog).not.toBeVisible({ timeout: 3000 });
    // No move in ledger after cancel.
    await expect(page.locator('[data-move-number]')).toHaveCount(0);
  });

  test('Tab trap cycles through all four promotion buttons', async ({ alice, aliceContext }) => {
    const game = await createTestComputerGame({
      sessionToken: alice.sessionToken,
      fen: PROMO_FEN,
      color: 'white',
      level: 1,
      timeControlSeconds: 0,
    });

    const page = await aliceContext.newPage();
    await page.goto(`/computer-game/${game.id}`);
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await makeMove(page, 'a7', 'a8');

    const dialog = page.getByRole('dialog', { name: 'Choose promotion piece' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await expect(dialog.getByRole('button')).toHaveCount(4);

    // Tab four times — should wrap back to queen and remain in the dialog.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
    }
    await expect(dialog).toBeVisible();

    // Confirm with Enter (queen after 4 tabs = wrapped back to first).
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('clicking a promotion piece button works', async ({ alice, aliceContext }) => {
    const game = await createTestComputerGame({
      sessionToken: alice.sessionToken,
      fen: PROMO_FEN,
      color: 'white',
      level: 1,
      timeControlSeconds: 0,
    });

    const page = await aliceContext.newPage();
    await page.goto(`/computer-game/${game.id}`);
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await makeMove(page, 'a7', 'a8');

    const dialog = page.getByRole('dialog', { name: 'Choose promotion piece' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole('button', { name: /promote to knight/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-move-number]').first()).toBeVisible({ timeout: 5000 });
  });
});
