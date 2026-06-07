import type { Metadata } from 'next';
import { ReportsTable } from '@/components/admin/reports-table';

export const metadata: Metadata = { title: 'Reports — Admin — Purchess' };

export default function AdminReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <ReportsTable />
    </div>
  );
}
