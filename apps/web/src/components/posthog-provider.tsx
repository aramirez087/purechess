'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { initPostHog, posthog } from '@/lib/posthog';
import { useSettingsStore } from '@/stores/settings-store';

interface AuthUser {
  id: string;
  username: string;
  isAdmin?: boolean;
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: AuthUser } | AuthUser;
  if ('user' in data && data.user) return data.user;
  if ('id' in data) return data as AuthUser;
  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  const appTheme = useSettingsStore((s) => s.appTheme);

  useEffect(() => {
    if (!initialized.current) {
      initPostHog();
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      posthog.reset();
      return;
    }
    posthog.identify(user.id, {
      username: user.username,
      isAdmin: user.isAdmin ?? false,
      theme: appTheme,
    });
  }, [user, appTheme]);

  return <>{children}</>;
}
