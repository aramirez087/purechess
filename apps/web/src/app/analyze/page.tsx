import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { AnalyzeClient } from './analyze-client';

export const metadata: Metadata = buildMetadata({
  title: 'Analyze — Purechess',
  description:
    'Paste a PGN game or a FEN position and step through it with a local Stockfish evaluation.',
  canonical: '/analyze',
});

export default function AnalyzePage() {
  return <AnalyzeClient />;
}
