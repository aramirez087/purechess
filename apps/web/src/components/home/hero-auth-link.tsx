'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api/auth';

const LINK_CLASSES =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';

/**
 * Session-aware hero nav CTA. Renders the signed-out "Sign in" markup by
 * default (SSR / no-JS / while the session resolves — the home page is
 * anonymous-majority, so this avoids layout shift for most visitors) and
 * swaps to "Your games" once /api/auth/me resolves a user. Shares the
 * ['auth', 'me'] cache with UserMenu, so no duplicate request.
 */
export function HeroAuthLink() {
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    staleTime: 60_000,
    retry: false,
  });

  if (data?.user) {
    return (
      <Link href="/games" className={LINK_CLASSES}>
        Your games
      </Link>
    );
  }

  return (
    <Link href="/login" className={LINK_CLASSES}>
      Sign in
    </Link>
  );
}
