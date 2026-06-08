import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileHeader } from '@/components/profile/profile-header';
import { RatingsCard } from '@/components/profile/ratings-card';
import { StatsCard } from '@/components/profile/stats-card';
import { RecentGames } from '@/components/profile/recent-games';
import { serverFetch } from '@/lib/api';
import type { ProfileDto, SafeUser } from '@purechess/shared';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username} on Purechess`,
    description: `${username}'s chess profile, ratings, and recent games.`,
    openGraph: {
      title: `${username} on Purechess`,
      description: `${username}'s chess profile, ratings, and recent games.`,
      images: ['/og-image.png'],
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

  const [profile, meResult] = await Promise.all([
    serverFetch<ProfileDto>(`/api/users/${username}`, {
      next: { revalidate: 60, tags: [`profile:${username}`] },
      withAuth: true,
    }),
    serverFetch<{ user: SafeUser }>('/api/auth/me', { withAuth: true }),
  ]);

  if (!profile) notFound();

  const currentUser = meResult?.user ?? null;
  const isOwnProfile = currentUser?.username?.toLowerCase() === username.toLowerCase();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-6">
        <ProfileHeader
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          createdAt={profile.createdAt}
          isOwnProfile={isOwnProfile}
        />
        <RatingsCard ratings={profile.ratings} />
        <StatsCard stats={profile.stats} />
        <RecentGames games={profile.recentGames} />
      </div>
    </AppShell>
  );
}
