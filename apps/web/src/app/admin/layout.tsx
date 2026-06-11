import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';

async function getMe() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('purechess_session');
  if (!sessionCookie) return null;

  const apiUrl =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `purechess_session=${sessionCookie.value}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    // /api/auth/me wraps the user in a {user} envelope (null when anonymous).
    const body = (await res.json()) as { user: { isAdmin?: boolean } | null };
    return body.user;
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getMe();
  if (!user?.isAdmin) redirect('/');

  return <AdminShell>{children}</AdminShell>;
}
