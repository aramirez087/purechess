import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@purchess/shared'],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'purchess',
  project: process.env.SENTRY_PROJECT ?? 'purchess-web',
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
