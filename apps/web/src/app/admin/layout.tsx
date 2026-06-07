import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';

async function getMe() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('purechess_session');
  if (!sessionCookie) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `purechess_session=${sessionCookie.value}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getMe();
  if (!user?.isAdmin) redirect('/');

  return <AdminShell>{children}</AdminShell>;
}
