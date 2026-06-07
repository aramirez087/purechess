import type { Metadata } from 'next';
import { UsersTable } from '@/components/admin/users-table';

export const metadata: Metadata = { title: 'Users — Admin — Purchess' };

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <UsersTable />
    </div>
  );
}
