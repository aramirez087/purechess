import type { Metadata } from 'next';
import { QuickPlayClient } from './quick-play-client';

export const metadata: Metadata = {
  title: 'Finding opponent — Purechess',
  description: 'Joining the quick-match queue.',
};

/** 1-click play: reads saved prefs and joins the queue immediately. */
export default function QuickPlayPage() {
  return <QuickPlayClient />;
}