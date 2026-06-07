import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/api';
import type { SafeUser } from '@purechess/shared';

export const dynamic = 'force-dynamic';

export default async function MeProfilePage() {
  const result = await serverFetch<{ user: SafeUser }>('/api/auth/me', { withAuth: true });

  if (!result) {
    redirect('/login?return=/profile/me');
  }

  redirect(`/profile/${result.user.username}`);
}
