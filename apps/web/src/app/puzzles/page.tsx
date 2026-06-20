import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { PuzzleClient } from './puzzle-client';

export const metadata: Metadata = buildMetadata({
  title: 'Daily puzzle — Purechess',
  description: "Solve today's chess puzzle. A new puzzle every day.",
  canonical: '/puzzles',
});

export default function PuzzlesPage() {
  return <PuzzleClient />;
}
