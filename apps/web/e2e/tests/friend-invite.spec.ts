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

    const inviteCodeEl = alicePage.locator('[data-testid="invite-link"]');
    await expect(inviteCodeEl).toBeVisible({ timeout: 10000 });
    const inviteLink = (await inviteCodeEl.textContent())?.trim() ?? '';
    expect(inviteLink).toMatch(/https?:\/\//);

    await bobPage.goto(inviteLink);
    await bobPage.getByRole('button', { name: /accept|join/i }).click();

    await expect(alicePage).toHaveURL(/\/play\//, { timeout: 20000 });
    await expect(bobPage).toHaveURL(/\/play\//, { timeout: 20000 });

    await expect(alicePage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });
});
