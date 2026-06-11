import { test, expect } from '@playwright/test';

const VALID_PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
const VALID_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const INVALID_INPUT = 'this is not a valid pgn or fen';

test.describe('Analyze flow', () => {
  test('valid PGN produces a review board', async ({ page }) => {
    await page.goto('/analyze');

    await page.locator('#analysis-input').fill(VALID_PGN);
    await page.getByRole('button', { name: /analyze/i }).click();

    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });

  test('valid FEN produces a review board', async ({ page }) => {
    await page.goto('/analyze');

    await page.locator('#analysis-input').fill(VALID_FEN);
    await page.getByRole('button', { name: /analyze/i }).click();

    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });
  });

  test('invalid input shows error alert', async ({ page }) => {
    await page.goto('/analyze');

    await page.locator('#analysis-input').fill(INVALID_INPUT);
    await page.getByRole('button', { name: /analyze/i }).click();

    // Scope to the app's error alert: Next injects an empty
    // role="alert" route-announcer, so an unscoped getByRole('alert') is
    // ambiguous (strict-mode violation). Filter by the error text.
    const errorAlert = page.getByRole('alert').filter({ hasText: /couldn't read that/i });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
  });

  test('"New analysis" button resets the view', async ({ page }) => {
    await page.goto('/analyze');

    await page.locator('#analysis-input').fill(VALID_PGN);
    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /new analysis/i }).click();

    // Board should be gone; input should be empty.
    await expect(page.locator('[data-testid="chess-board"]')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('#analysis-input')).toBeVisible();
  });
});
