import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { OpeningsSubNav } from '@/components/openings/openings-sub-nav';

export default function OpeningsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <OpeningsSubNav />
      {children}
    </AppShell>
  );
}