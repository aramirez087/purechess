'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    useSettingsStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (theme && theme !== storeAppTheme) {
      update({ appTheme: theme as 'light' | 'dark' | 'system' });
    }
  }, [theme, storeAppTheme, update]);

  useEffect(() => {
    if (storeAppTheme && storeAppTheme !== theme) {
      setTheme(storeAppTheme);
    }
  }, [storeAppTheme, theme, setTheme]);

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
