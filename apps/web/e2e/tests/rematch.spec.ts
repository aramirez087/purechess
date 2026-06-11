import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';
import { extractGameId, makeMove } from '../helpers/game-helpers';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * PvP rematch: after a finished game, the offer creates a linked
 * color-swapped game; accepting navigates both players into it on the
 * pending→accepted transition.
 *
 * Resign needs 2+ plies (the footer shows Abort before that), so each test
 * opens with 1. e4 e5 and ends the game by resignation.
 */
test.describe('PvP rematch', () => {
  async function finishGameByResign(opts: {
    aliceId: string;
    bobId: string;
    aliceContext: BrowserContext;
    bobContext: BrowserContext;
  }): Promise<{ alicePage: Page; bobPage: Page; gameId: string }> {
    const game = await createTestGame({
      whiteUserId: opts.aliceId,
      blackUserId: opts.bobId,
      status: 'active',
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const alicePage = await opts.aliceContext.newPage();
    const bobPage = await opts.bobContext.newPage();
    await alicePage.goto(`/play/${game.id}`);
    await bobPage.goto(`/play/${game.id}`);
    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    // Bob must be subscribed to the room before the game ends or he misses
    // the WS pushes (game over AND the later rematch offer).
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await makeMove(alicePage, 'e2', 'e4');
    await expect(bobPage.locator('[data-square="e4"] img')).toBeVisible({ timeout: 10000 });
    await makeMove(bobPage, 'e7', 'e5');
    await expect(alicePage.locator('[data-square="e5"] img')).toBeVisible({ timeout: 10000 });

    await alicePage.getByRole('button', { name: /resign/i }).click();
    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });

    return { alicePage, bobPage, gameId: game.id };
  }

  test('Alice offers a rematch after resigning, Bob accepts, both land in the new game', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    const { alicePage, bobPage, gameId } = await finishGameByResign({
      aliceId: alice.id,
      bobId: bob.id,
      aliceContext,
      bobContext,
    });

    // Alice offers from the result overlay.
    await alicePage
      .locator('[data-testid="game-result"]')
      .getByRole('button', { name: /rematch/i })
      .click();

    // The offer reaches Bob as game state; his footer button relabels.
    await bobPage.getByRole('button', { name: /accept rematch/i }).click({ timeout: 10000 });

    // Both navigate into the same new game, distinct from the old one.
    const notOldGame = (url: URL) =>
      /^\/play\/[a-z0-9]+$/i.test(url.pathname) && !url.pathname.includes(gameId);
    await alicePage.waitForURL(notOldGame, { timeout: 20000 });
    await bobPage.waitForURL(notOldGame, { timeout: 20000 });

    const aliceGameId = extractGameId(alicePage.url());
    const bobGameId = extractGameId(bobPage.url());
    expect(aliceGameId).toBe(bobGameId);
    expect(aliceGameId).not.toBe(gameId);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });

  test('declined rematch leaves both players on the finished game', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    const { alicePage, bobPage, gameId } = await finishGameByResign({
      aliceId: alice.id,
      bobId: bob.id,
      aliceContext,
      bobContext,
    });

    await alicePage
      .locator('[data-testid="game-result"]')
      .getByRole('button', { name: /rematch/i })
      .click();

    await expect(bobPage.getByRole('button', { name: /accept rematch/i })).toBeVisible({
      timeout: 10000,
    });
    await bobPage.getByRole('button', { name: /^decline$/i }).click();

    // Alice's offer clears (footer goes back to a plain Rematch button) and
    // nobody navigates anywhere.
    await expect(alicePage.getByRole('button', { name: /rematch offered/i })).not.toBeVisible({
      timeout: 10000,
    });
    expect(extractGameId(alicePage.url())).toBe(gameId);
    expect(extractGameId(bobPage.url())).toBe(gameId);
  });
});
