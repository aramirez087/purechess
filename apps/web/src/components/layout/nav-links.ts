import type { LucideIcon } from 'lucide-react';
import { Castle, Target } from 'lucide-react';

export type NavLink = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

/** Primary destinations — desktop top bar + mobile drawer. */
export const PRIMARY_NAV_LINKS: NavLink[] = [
  { href: '/play', label: 'Play' },
  { href: '/train', label: 'Train', icon: Target },
  { href: '/openings', label: 'Openings', icon: Castle },
  { href: '/puzzles', label: 'Puzzles' },
  { href: '/endgames', label: 'Endgames' },
  { href: '/games', label: 'Games' },
  { href: '/analyze', label: 'Analyze' },
];

/** Mobile-only shortcuts (profile/settings live in UserMenu on desktop). */
export const MOBILE_EXTRA_NAV_LINKS: NavLink[] = [
  { href: '/profile/me', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}