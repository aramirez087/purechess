import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { InviteAccept } from './invite-accept';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'Game Invite — Purechess',
    description: `You have been invited to play chess on Purechess. Token: ${token}`,
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <InviteAccept token={token} />
      </div>
    </AppShell>
  );
}
