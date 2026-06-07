import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://purchess.com';

type BuildMetadataInput = {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
};

export function buildMetadata({
  title,
  description,
  canonical,
  ogImage = '/og-image.png',
}: BuildMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
