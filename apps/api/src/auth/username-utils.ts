import { isReservedUsername } from './reserved-usernames';

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,18}[a-zA-Z0-9]$/;

/** Normalize an email local-part into a valid PureChess username seed. */
export function usernameSeedFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? 'user')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16);
  return local.length >= 3 ? local : 'user';
}

export function isValidUsername(username: string): boolean {
  return (
    USERNAME_PATTERN.test(username) && !isReservedUsername(username)
  );
}

/** Pick the next available username from a base, honoring reserved names + pattern. */
export async function pickAvailableUsername(
  findTaken: (username: string) => Promise<boolean>,
  base: string,
): Promise<string> {
  let candidate = usernameSeedFromEmail(base);
  if (!isValidUsername(candidate)) candidate = 'user';
  let suffix = 1;
  while (
    (await findTaken(candidate)) ||
    !isValidUsername(candidate)
  ) {
    const stem = usernameSeedFromEmail(base).slice(0, 12) || 'user';
    candidate = `${stem}${suffix++}`;
    if (candidate.length > 20) {
      candidate = `user${suffix}`;
    }
  }
  return candidate;
}