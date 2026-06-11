import { test } from '../fixtures/auth.fixture';

// Matchmaking UI is not implemented — players currently start games via friend
// invite or direct game creation. Skip until the matchmaking flow is built.
test.describe('Rated blitz game — Alice vs Bob', () => {
  test.skip('both players match, play, and see rating deltas', async () => {
    // Requires matchmaking queue UI (/play → "Rated" / "Blitz" buttons).
    // Not yet implemented. Tracked for a future session.
  });
});
