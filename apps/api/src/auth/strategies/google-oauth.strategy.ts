import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { oauthCallbackUrl } from '../oauth-urls';

export interface GoogleOAuthProfile {
  provider: 'google';
  providerUserId: string;
  email: string;
  displayName: string;
}

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('OAUTH_GOOGLE_CLIENT_ID') || 'dev-placeholder';
    const clientSecret = config.get<string>('OAUTH_GOOGLE_CLIENT_SECRET') || 'dev-placeholder';
    super({
      clientID,
      clientSecret,
      callbackURL: oauthCallbackUrl(config, 'google'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: Array<{ value: string }>; displayName?: string },
  ): GoogleOAuthProfile {
    return {
      provider: 'google',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName ?? '',
    };
  }
}