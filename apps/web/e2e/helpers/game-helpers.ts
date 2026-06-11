import { Page } from '@playwright/test';

export async function waitForGameUrl(page: Page): Promise<string> {
  await page.waitForURL(/\/play\/[a-z0-9]+/i, { timeout: 15000 });
  return page.url();
}

export function extractGameId(url: string): string {
  const match = /\/(?:play|games)\/([a-z0-9]+)/i.exec(url);
  if (!match) throw new Error(`No game ID in URL: ${url}`);
  return match[1]!;
}

export async function clickSquare(page: Page, squareId: string): Promise<void> {
  await page.locator(`[data-square="${squareId}"]`).click();
}

export async function makeMove(page: Page, from: string, to: string): Promise<void> {
  await clickSquare(page, from);
  await clickSquare(page, to);
}

export async function waitForOpponentMove(page: Page, currentMoveCount: number): Promise<void> {
  await page.waitForFunction(
    (count) => {
      const moves = document.querySelectorAll('[data-move-number]');
      return moves.length > count;
    },
    currentMoveCount,
    { timeout: 10000 },
  );
}

export async function getMoveCount(page: Page): Promise<number> {
  return page.locator('[data-move-number]').count();
}

export async function injectSession(page: Page, token: string): Promise<void> {
  const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';
  await page.goto(baseURL);
  await page.evaluate((t) => {
    document.cookie = `purechess_session=${t}; path=/`;
  }, token);
}
