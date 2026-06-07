import type { Metadata } from 'next';
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
  return <InviteAccept token={token} />;
}
