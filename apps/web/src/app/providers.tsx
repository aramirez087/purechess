'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/query-client';
import { useSettingsStore } from '@/stores/settings-store';
import { PostHogProvider } from '@/components/posthog-provider';

function ThemeSync() {
  const { theme, setTheme } = useTheme();
  const storeAppTheme = useSettingsStore((s) => s.appTheme);
  const update = useSettingsStore((s) => s.update);
  // Tracks the value this effect last propagated, so an echo render (the store
  // or next-themes updating *because of* our own sync) is not mistaken for a
  // fresh user change and bounced back — the previous two-effect version did
  // exactly that and span into an infinite update loop whenever the persisted
  // appTheme and next-themes disagreed on load.
  const lastSynced = useRef<string | undefined>(undefined);

  useEffect(() => {
    useSettingsStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!theme || storeAppTheme === theme) return;
    if (storeAppTheme !== lastSynced.current) {
      // The store changed (including persisted hydration) — it is the source of
      // truth, so push it into next-themes.
      lastSynced.current = storeAppTheme;
      setTheme(storeAppTheme);
    } else {
      // next-themes changed on its own (e.g. a theme-only control) — mirror it
      // back into the store.
      lastSynced.current = theme;
      update({ appTheme: theme as 'light' | 'dark' | 'system' });
    }
  }, [theme, storeAppTheme, setTheme, update]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          <ThemeSync />
          {children}
          <Toaster />
        </PostHogProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
