import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { buildMetadata } from '@/lib/seo';
import { EditorClient } from './editor-client';

export const metadata: Metadata = buildMetadata({
  title: 'Board editor — Purechess',
  description: 'Set up any chess position and analyze it or practice vs computer.',
  canonical: '/editor',
});

export default function EditorPage() {
  return (
    <AppShell>
      <EditorClient />
    </AppShell>
  );
}
