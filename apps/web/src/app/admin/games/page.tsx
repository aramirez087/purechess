import type { Metadata } from 'next';
import { GamesTable } from '@/components/admin/games-table';

export const metadata: Metadata = { title: 'Games — Admin — Purchess' };

export default function AdminGamesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Games</h1>
      <GamesTable />
    </div>
  );
}
