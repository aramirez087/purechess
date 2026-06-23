'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';

export function OAuthButtons() {
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean } | null>(
    null,
  );

  useEffect(() => {
    apiFetch<{ google: boolean; apple: boolean }>('/auth/oauth/providers')
      .then(setProviders)
      .catch(() => setProviders({ google: false, apple: false }));
  }, []);

  if (!providers?.google && !providers?.apple) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/70" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border/70" />
      </div>
      <div className="flex flex-col gap-2">
        {providers.google && (
          <a
            href="/api/auth/oauth/google"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border/70 bg-background/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Continue with Google
          </a>
        )}
        {providers.apple && (
          <a
            href="/api/auth/oauth/apple"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border/70 bg-background/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Continue with Apple
          </a>
        )}
      </div>
    </div>
  );
}