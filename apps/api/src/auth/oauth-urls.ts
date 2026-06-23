import type { ConfigService } from '@nestjs/config';

/** OAuth callbacks must hit the web origin so session cookies stay first-party. */
export function oauthCallbackUrl(
  config: ConfigService,
  provider: 'google' | 'apple',
): string {
  const explicit =
    provider === 'google'
      ? config.get<string>('OAUTH_GOOGLE_CALLBACK_URL')
      : config.get<string>('OAUTH_APPLE_CALLBACK_URL');
  if (explicit) return explicit;

  const appOrigin =
    config.get<string>('WEB_URL') ??
    config.get<string>('NEXT_PUBLIC_APP_URL') ??
    'http://localhost:3000';
  return `${appOrigin.replace(/\/$/, '')}/api/auth/oauth/${provider}/callback`;
}

export function appOrigin(config: ConfigService): string {
  return (
    config.get<string>('NEXT_PUBLIC_APP_URL') ??
    config.get<string>('WEB_URL') ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
}