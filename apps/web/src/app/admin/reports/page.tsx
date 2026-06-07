import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reports — Admin — Purchess' };

export default function AdminReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="text-sm text-muted-foreground">Reports management will be added in Session 20.</p>
    </div>
  );
}
