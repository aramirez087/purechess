import type { Metadata } from 'next';
import { PlayPageClient } from './play-page-client';

export const metadata: Metadata = {
  title: 'Play — Purchess',
  description: 'Start a game on Purchess.',
};

export default function PlayPage() {
  return <PlayPageClient />;
}
