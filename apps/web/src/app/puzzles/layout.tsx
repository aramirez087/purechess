import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PuzzleSubNav } from '@/components/puzzle/puzzle-sub-nav';

export default function PuzzlesLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <PuzzleSubNav />
      {children}
    </AppShell>
  );
}