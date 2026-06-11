import { test } from '../fixtures/auth.fixture';

// Matchmaking pairing itself is covered in quick-match.spec.ts; rated
// finalization (Glicko-2 deltas) in rated-finalization.spec.ts. This spec is
// reserved for a full play-through with visible rating deltas in the UI.
test.describe('Rated blitz game — Alice vs Bob', () => {
  test.skip('both players match, play a full game, and see rating deltas', async () => {
    // Full-game play-through (scripted mate) not yet automated. Tracked for a
    // future session.
  });
});
