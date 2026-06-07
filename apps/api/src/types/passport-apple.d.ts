declare module 'passport-apple' {
  import { Strategy as PassportStrategy } from 'passport';

  interface AppleStrategyOptions {
    clientID: string;
    teamID: string;
    keyID: string;
    privateKeyString?: string;
    privateKeyLocation?: string;
    callbackURL: string;
    passReqToCallback?: boolean;
  }

  interface AppleIdToken {
    sub: string;
    email?: string;
    email_verified?: string;
    is_private_email?: string;
    aud: string;
    iat: number;
    exp: number;
  }

  type VerifyCallback = (error: Error | null, user?: unknown, info?: unknown) => void;

  type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    idToken: AppleIdToken,
    profile: unknown,
    done: VerifyCallback,
  ) => void;

  class Strategy extends PassportStrategy {
    constructor(options: AppleStrategyOptions, verify: VerifyFunction);
    authenticate(req: unknown, options?: unknown): void;
  }
}
