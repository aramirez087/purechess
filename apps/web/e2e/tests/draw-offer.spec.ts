import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';
import { makeMove } from '../helpers/game-helpers';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * PvP draw offers. The Draw button only appears once the game has 2+ plies
 * (before that the footer shows Abort), so each test opens with 1. e4 e5.
 */
test.describe('PvP draw offer', () => {
  async function startGameWithTwoPlies(opts: {
    aliceId: string;
    bobId: string;
    aliceContext: BrowserContext;
    bobContext: BrowserContext;
  }): Promise<{ alicePage: Page; bobPage: Page }> {
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
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    // 1. e4 — Bob waits for it to land before replying (his early click
    // would be treated as a premove and rejected).
    await makeMove(alicePage, 'e2', 'e4');
    await expect(bobPage.locator('[data-square="e4"] img')).toBeVisible({ timeout: 10000 });
    // 1... e5
    await makeMove(bobPage, 'e7', 'e5');
    await expect(alicePage.locator('[data-square="e5"] img')).toBeVisible({ timeout: 10000 });

    return { alicePage, bobPage };
  }

  test('Alice offers, Bob accepts, both see the draw result', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    const { alicePage, bobPage } = await startGameWithTwoPlies({
      aliceId: alice.id,
      bobId: bob.id,
      aliceContext,
      bobContext,
    });

    await alicePage.getByRole('button', { name: /^draw$/i }).click();
    await expect(alicePage.getByRole('button', { name: /draw offered/i })).toBeVisible({
      timeout: 10000,
    });

    // Offer is pushed to Bob over WS as part of the game state. Assert on the
    // banner's button — plain text matching collides with the sr-only
    // aria-live mirror of the same copy.
    await bobPage.getByRole('button', { name: /accept draw/i }).click({ timeout: 10000 });

    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(alicePage.locator('[data-testid="game-result"]')).toContainText(/draw/i);
    await expect(bobPage.locator('[data-testid="game-result"]')).toContainText(/draw/i);
  });

  test('Alice offers, Bob declines, game continues', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    const { alicePage, bobPage } = await startGameWithTwoPlies({
      aliceId: alice.id,
      bobId: bob.id,
      aliceContext,
      bobContext,
    });

    await alicePage.getByRole('button', { name: /^draw$/i }).click();
    await expect(bobPage.getByRole('button', { name: /accept draw/i })).toBeVisible({
      timeout: 10000,
    });

    await bobPage.getByRole('button', { name: /^decline$/i }).click();

    // Banner clears for Bob; Alice's pending state reverts to a fresh Draw button.
    await expect(bobPage.getByRole('button', { name: /accept draw/i })).not.toBeVisible({
      timeout: 10000,
    });
    await expect(alicePage.getByRole('button', { name: /^draw$/i })).toBeVisible({
      timeout: 10000,
    });

    // No result overlay anywhere — the game is still live.
    await expect(alicePage.locator('[data-testid="game-result"]')).not.toBeVisible();
    await expect(bobPage.locator('[data-testid="game-result"]')).not.toBeVisible();
  });
});
