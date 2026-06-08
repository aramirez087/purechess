import type { Metadata } from 'next';
import { ReportsTable } from '@/components/admin/reports-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Reports — Admin — Purechess' };

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports"
        description="Player-submitted reports awaiting moderator review."
      />
      <ReportsTable />
    </div>
  );
}
