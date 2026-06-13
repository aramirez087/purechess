import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { AnalyzeClient } from './analyze-client';

export const metadata: Metadata = buildMetadata({
  title: 'Analyze — Purechess',
  description:
    'Paste a PGN game or a FEN position and step through it with a local Stockfish evaluation.',
  canonical: '/analyze',
});

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ fen?: string }>;
}) {
  const sp = await searchParams;
  return <AnalyzeClient initialInput={sp.fen ?? ''} />;
}
