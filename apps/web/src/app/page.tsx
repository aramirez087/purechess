import { AppShell } from '@/components/layout/AppShell';
import { Hero } from '@/components/home/hero';
import { Footer } from '@/components/home/footer';
import { HomeViewedTracker } from '@/components/home/home-viewed-tracker';
import { buildMetadata, SITE_URL } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Purechess — Pure chess. Nothing else.',
  description:
    'The cleanest way to play chess online. No ads, no clutter, just a great board.',
  canonical: SITE_URL,
});

export default function HomePage() {
  return (
    <AppShell variant="minimal">
      <HomeViewedTracker />
      <Hero />
      <Footer />
    </AppShell>
  );
}
