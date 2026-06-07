import { test as base, BrowserContext } from '@playwright/test';
import { createTestUser, TestUser } from '../helpers/test-api';
import { injectSession } from '../helpers/game-helpers';

interface AuthFixtures {
  alice: TestUser;
  bob: TestUser;
  aliceContext: BrowserContext;
  bobContext: BrowserContext;
}

let _counter = 0;
function uniqueSuffix(): string {
  return `${Date.now()}-${++_counter}`;
}

export const test = base.extend<AuthFixtures>({
  alice: async ({}, use) => {
    const s = uniqueSuffix();
    const user = await createTestUser({ username: `alice-${s}`, email: `alice-${s}@e2e.test` });
    await use(user);
  },

  bob: async ({}, use) => {
    const s = uniqueSuffix();
    const user = await createTestUser({ username: `bob-${s}`, email: `bob-${s}@e2e.test` });
    await use(user);
  },

  aliceContext: async ({ browser, alice }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await injectSession(page, alice.sessionToken);
    await page.close();
    await use(ctx);
    await ctx.close();
  },

  bobContext: async ({ browser, bob }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await injectSession(page, bob.sessionToken);
    await page.close();
    await use(ctx);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
