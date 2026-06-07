import { test, expect } from '../fixtures/auth.fixture';

test.describe('Friend invite flow', () => {
  test('Alice creates invite, Bob accepts, both land on game page', async ({
    aliceContext,
    bobContext,
  }) => {
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    await alicePage.goto('/play');
    await alicePage.getByRole('button', { name: /play a friend|invite/i }).click();

    const inviteLink = await alicePage.locator('[data-testid="invite-link"]').inputValue({ timeout: 10000 });
    expect(inviteLink).toMatch(/https?:\/\//);

    await bobPage.goto(inviteLink);
    await bobPage.getByRole('button', { name: /accept|join/i }).click();

    await expect(alicePage).toHaveURL(/\/games\//, { timeout: 20000 });
    await expect(bobPage).toHaveURL(/\/games\//, { timeout: 20000 });

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });
});
