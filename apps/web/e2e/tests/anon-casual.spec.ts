import { test } from '@playwright/test';

// Anonymous matchmaking is not implemented — requires auth for all game modes.
// Skip until the anonymous-play flow is built.
test.describe('Anonymous casual game', () => {
  test.skip('two anon users match and play', async () => {
    // Requires anonymous matchmaking queue UI and backend support.
    // Not yet implemented. Tracked for a future session.
  });
});
