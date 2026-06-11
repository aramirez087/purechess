import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';
import { getMoveCount } from '../helpers/game-helpers';

test.describe('Premove (out-of-turn input)', () => {
  test("Bob tries to move before it's his turn — server rejects, board unchanged", async ({
    alice,
    bob,
    bobContext,
  }) => {
    // Alice is white (moves first), Bob is black.
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'active',
      timeControlSeconds: 300,
      incrementSeconds: 0,
      category: 'blitz',
    });

    const bobPage = await bobContext.newPage();
    await bobPage.goto(`/play/${game.id}`);
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    const beforeCount = await getMoveCount(bobPage);

    // Bob (black) attempts to move e7→e5 but it's White's turn.
    await bobPage.locator('[data-square="e7"]').click();
    await bobPage.locator('[data-square="e5"]').click();

    // Give the server time to respond.
    await bobPage.waitForTimeout(1500);

    const afterCount = await getMoveCount(bobPage);
    expect(afterCount).toBe(beforeCount);
  });

  test("Alice cannot move twice in a row — second move is rejected", async ({
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

    // Alice makes her first legal move.
    await alicePage.locator('[data-square="e2"]').click();
    await alicePage.locator('[data-square="e4"]').click();

    // Wait for the move to register.
    await alicePage.waitForFunction(() => {
      return document.querySelectorAll('[data-move-number]').length >= 1;
    }, { timeout: 5000 });

    // Alice immediately tries a second move while it's Bob's turn.
    await alicePage.locator('[data-square="d2"]').click();
    await alicePage.locator('[data-square="d4"]').click();

    await alicePage.waitForTimeout(1500);

    // Only 1 move in the ledger — the second was rejected.
    const count = await getMoveCount(alicePage);
    expect(count).toBe(1);
  });
});
