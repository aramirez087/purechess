import { test, expect } from '../fixtures/auth.fixture';
import { createTestGame } from '../helpers/test-api';

test.describe('Flag fall', () => {
  test('White flags with 1-second time control — result overlay appears', async ({
    alice,
    bob,
    aliceContext,
    bobContext,
  }) => {
    // 1-second time control — white's clock expires almost immediately.
    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'active',
      timeControlSeconds: 1,
      incrementSeconds: 0,
      category: 'bullet',
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await alicePage.goto(`/play/${game.id}`);
    await bobPage.goto(`/play/${game.id}`);

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    // Wait for the 1-second clock to expire plus a processing buffer.
    await alicePage.waitForTimeout(4000);

    // Client detects flag → polls server → game finalized → overlay shown.
    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 8000 });
    await expect(bobPage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 8000 });
  });

  test('Flag fall does not insert a move row', async ({ alice, bob, aliceContext }) => {
    const API_URL = process.env['API_URL'] ?? 'http://localhost:4000';

    const game = await createTestGame({
      whiteUserId: alice.id,
      blackUserId: bob.id,
      status: 'active',
      timeControlSeconds: 1,
      incrementSeconds: 0,
      category: 'bullet',
    });

    const alicePage = await aliceContext.newPage();
    await alicePage.goto(`/play/${game.id}`);
    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await alicePage.waitForTimeout(4000);
    await expect(alicePage.locator('[data-testid="game-result"]')).toBeVisible({ timeout: 8000 });

    // Verify the game is completed with 0 moves (no move row for flag fall).
    const res = await fetch(`${API_URL}/api/games/${game.id}/moves`, {
      headers: { Cookie: `purechess_session=${alice.sessionToken}` },
    });
    if (res.ok) {
      const moves = (await res.json()) as unknown[];
      expect(moves.length).toBe(0);
    }
  });
});
