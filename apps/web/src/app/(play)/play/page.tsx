import type { Metadata } from 'next';
import { PlayPageClient } from './play-page-client';

export const metadata: Metadata = {
  title: 'Play — Purechess',
  description: 'Start a game on Purechess.',
};

export default function PlayPage() {
  return <PlayPageClient />;
}
