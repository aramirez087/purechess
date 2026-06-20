'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Crown } from 'lucide-react';
import { QuickMatchSetup } from '@/components/play/quick-match-setup';

const AMBIENT =
  'radial-gradient(125% 80% at 50% -10%, hsl(var(--brass) / 0.10), transparent 55%), radial-gradient(120% 120% at 50% 115%, hsl(var(--shadow-rgb) / 0.45), transparent 55%), radial-gradient(60% 35% at 50% 100%, hsl(var(--brass) / 0.05), transparent 70%), hsl(var(--background))';

function QuickShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="grain relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-6"
      style={{ background: AMBIENT }}
    >
      <div className="relative z-10 w-full max-w-lg">
        <Link
          href="/play"
          className="mb-6 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Change mode
        </Link>
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brass/10 text-brass ring-1 ring-inset ring-brass/30">
            <Crown className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/85">
            Quick match
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

export function QuickPlayClient() {
  return (
    <QuickShell>
      <QuickMatchSetup autoStart loginReturn="/play/quick" />
    </QuickShell>
  );
}