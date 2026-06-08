import type { Metadata } from 'next';
import { UsersTable } from '@/components/admin/users-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Users — Admin — Purechess' };

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="All registered players and their account state."
      />
      <UsersTable />
    </div>
  );
}
