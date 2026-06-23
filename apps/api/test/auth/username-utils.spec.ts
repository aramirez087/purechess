import { isValidUsername, usernameSeedFromEmail } from '../../src/auth/username-utils';

describe('username-utils', () => {
  it('usernameSeedFromEmail strips invalid chars', () => {
    expect(usernameSeedFromEmail('alice.smith@example.com')).toBe('alicesmith');
  });

  it('rejects reserved names', () => {
    expect(isValidUsername('admin')).toBe(false);
    expect(isValidUsername('player1')).toBe(true);
  });
});