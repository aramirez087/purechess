import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

// Fool's mate: 1. f3 e5 2. g4 Qh4# — shortest possible checkmate.
// White (Alice) plays f3, then g4; Black (Bob) plays e5, then Qh4#.
const FOOLS_MATE_MOVES = [
  { from: 'f2', to: 'f3' }, // White 1. f3
  { from: 'e7', to: 'e5' }, // Black 1...e5
  { from: 'g2', to: 'g4' }, // White 2. g4
  { from: 'd8', to: 'h4' }, // Black 2...Qh4#
];

test.describe('Rated game finalization', () => {
  test('checkmate triggers Glicko-2 update — both players get new ratings', async ({
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
      isRated: true,
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await alicePage.goto(`/play/${game.id}`);
    await bobPage.goto(`/play/${game.id}`);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    // Play Fool's Mate: white, black, white, black.
    for (const [i, mv] of FOOLS_MATE_MOVES.entries()) {
      const page = i % 2 === 0 ? alicePage : bobPage;
      await page.locator(`[data-square="${mv.from}"]`).click();
      await page.locator(`[data-square="${mv.to}"]`).click();
      // Wait for the move to appear in the ledger before the next one.
      const expectedPly = i + 1;
      await alicePage.waitForFunction(
        (ply) => document.querySelectorAll('[data-move-number]').length >= ply,
        expectedPly,
        { timeout: 8000 },
      );
    }

    // Game over — both overlays should appear.
    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 10000 });

    // Navigate to Bob's profile and confirm rating section is rendered.
    await bobPage.goto(`/profile/${bob.username}`);
    await expect(bobPage.locator('[data-testid="user-rating"]')).toBeVisible({ timeout: 10000 });
  });
});
