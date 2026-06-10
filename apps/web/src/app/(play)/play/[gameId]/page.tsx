import type { Metadata } from 'next';
import { LiveGameClient } from './live-game-client';

export const metadata: Metadata = {
  title: 'Live game — Purechess',
  robots: 'noindex',
};

interface Props {
  params: { gameId: string };
}

export default function LiveGamePage({ params }: Props) {
  return <LiveGameClient gameId={params.gameId} />;
}
