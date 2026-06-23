export const RESERVED_USERNAMES = new Set([
  'admin',
  'purechess',
  'system',
  'root',
  'support',
  'help',
  'api',
  'www',
  'mail',
  'info',
  'moderator',
  'mod',
  'staff',
  'bot',
  'null',
  'undefined',
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}