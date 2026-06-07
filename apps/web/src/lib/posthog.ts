import posthog from 'posthog-js';

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (navigator.doNotTrack === '1') return;
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });

  initialized = true;
}

export { posthog };
