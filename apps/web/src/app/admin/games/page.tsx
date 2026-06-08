import type { Metadata } from 'next';
import { GamesTable } from '@/components/admin/games-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Games — Admin — Purechess' };

export default function AdminGamesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Games"
        description="Every rated and casual game on the platform."
      />
      <GamesTable />
    </div>
  );
}
