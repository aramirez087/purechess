import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-apple';

export interface AppleOAuthProfile {
  provider: 'apple';
  providerUserId: string;
  email: string;
  displayName: string;
}

@Injectable()
export class AppleOAuthStrategy extends PassportStrategy(Strategy, 'apple') {
  private static readonly logger = new Logger(AppleOAuthStrategy.name);

  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('OAUTH_APPLE_CLIENT_ID') ?? '',
      teamID: config.get<string>('OAUTH_APPLE_TEAM_ID') ?? '',
      keyID: config.get<string>('OAUTH_APPLE_KEY_ID') ?? '',
      privateKeyString: config.get<string>('OAUTH_APPLE_PRIVATE_KEY') ?? '',
      callbackURL: config.get<string>('OAUTH_APPLE_CALLBACK_URL'),
      passReqToCallback: false,
    });

    if (!config.get<string>('OAUTH_APPLE_TEAM_ID')) {
      AppleOAuthStrategy.logger.warn('Apple OAuth disabled: OAUTH_APPLE_TEAM_ID not set');
    }
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    idToken: { sub: string; email?: string },
    _profile: unknown,
  ): AppleOAuthProfile {
    return {
      provider: 'apple',
      providerUserId: idToken.sub,
      email: idToken.email ?? '',
      displayName: '',
    };
  }
}
