import type { Metadata } from 'next';
import { PlayPageClient } from './play-page-client';

export const metadata: Metadata = {
  title: 'Play — Purechess',
  description: 'Start a game on Purechess.',
};

type Props = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function PlayPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode = typeof sp.mode === 'string' ? sp.mode : undefined;
  return <PlayPageClient initialMode={mode} />;
}