type EnvVarDef = {
  type: 'string' | 'number' | 'boolean' | 'url';
  required: boolean;
  description: string;
  example?: string;
};

export const ENV_SCHEMA: Record<string, EnvVarDef> = {
  NODE_ENV: {
    type: 'string',
    required: false,
    description: 'Runtime environment',
    example: 'production',
  },
  PORT: {
    type: 'number',
    required: false,
    description: 'API server port',
    example: '4000',
  },
  DATABASE_URL: {
    type: 'url',
    required: true,
    description: 'Postgres connection string. Append ?sslmode=require&pgbouncer=true in prod (Neon pooler).',
    example: 'postgresql://user:pass@host:5432/purechess?sslmode=require&pgbouncer=true',
  },
  DATABASE_URL_DIRECT: {
    type: 'url',
    required: false,
    description: 'Direct Postgres URL (bypass pooler) — used for migrations only.',
    example: 'postgresql://user:pass@host:5432/purechess?sslmode=require',
  },
  REDIS_URL: {
    type: 'url',
    required: true,
    description: 'Redis connection string. Use rediss:// (TLS) in prod (Upstash).',
    example: 'rediss://default:password@host.upstash.io:6379',
  },
  SESSION_SECRET: {
    type: 'string',
    required: true,
    description: 'Minimum 32-char random string for session signing.',
    example: 'change-me-min-32-chars-random-string-here',
  },
  WEB_URL: {
    type: 'url',
    required: false,
    description: 'Public URL of the web app — added to CORS allowed origins.',
    example: 'https://purechesss.com',
  },
  NEXT_PUBLIC_APP_URL: {
    type: 'url',
    required: false,
    description: 'Public web URL exposed to client-side Next.js code.',
    example: 'https://purechesss.com',
  },
  NEXT_PUBLIC_API_URL: {
    type: 'url',
    required: false,
    description: 'Public API URL exposed to client-side Next.js code.',
    example: 'https://purechess-api.fly.dev',
  },
  NEXT_PUBLIC_WS_URL: {
    type: 'url',
    required: false,
    description: 'WebSocket URL for real-time game events.',
    example: 'wss://purechess-api.fly.dev',
  },
  OAUTH_GOOGLE_CLIENT_ID: {
    type: 'string',
    required: false,
    description: 'Google OAuth client ID.',
  },
  OAUTH_GOOGLE_CLIENT_SECRET: {
    type: 'string',
    required: false,
    description: 'Google OAuth client secret.',
  },
  OAUTH_GOOGLE_CALLBACK_URL: {
    type: 'url',
    required: false,
    description: 'Google OAuth callback URL.',
    example: 'https://purechess-api.fly.dev/api/auth/oauth/google/callback',
  },
  OAUTH_APPLE_CLIENT_ID: {
    type: 'string',
    required: false,
    description: 'Apple OAuth client ID (service ID).',
  },
  OAUTH_APPLE_TEAM_ID: {
    type: 'string',
    required: false,
    description: 'Apple developer team ID.',
  },
  OAUTH_APPLE_KEY_ID: {
    type: 'string',
    required: false,
    description: 'Apple private key ID.',
  },
  OAUTH_APPLE_PRIVATE_KEY: {
    type: 'string',
    required: false,
    description: 'Apple private key contents (PEM). Newlines as \\n.',
  },
  OAUTH_APPLE_CALLBACK_URL: {
    type: 'url',
    required: false,
    description: 'Apple OAuth callback URL.',
    example: 'https://purechess-api.fly.dev/api/auth/oauth/apple/callback',
  },
  SENTRY_DSN: {
    type: 'url',
    required: false,
    description: 'Sentry DSN for API error tracking. Omit to disable.',
  },
  SENTRY_AUTH_TOKEN: {
    type: 'string',
    required: false,
    description: 'Sentry auth token for source map upload in CI.',
  },
  SENTRY_ORG: {
    type: 'string',
    required: false,
    description: 'Sentry organization slug.',
    example: 'purechess',
  },
  SENTRY_PROJECT: {
    type: 'string',
    required: false,
    description: 'Sentry project slug.',
    example: 'purechess-web',
  },
  SENTRY_ENV: {
    type: 'string',
    required: false,
    description: 'Sentry environment tag.',
    example: 'production',
  },
  NEXT_PUBLIC_SENTRY_DSN: {
    type: 'url',
    required: false,
    description: 'Sentry DSN for client-side Next.js error tracking.',
  },
  POSTHOG_API_KEY: {
    type: 'string',
    required: false,
    description: 'PostHog server-side API key.',
  },
  POSTHOG_HOST: {
    type: 'url',
    required: false,
    description: 'PostHog host. Default: EU region.',
    example: 'https://eu.posthog.com',
  },
  NEXT_PUBLIC_POSTHOG_KEY: {
    type: 'string',
    required: false,
    description: 'PostHog client-side API key.',
  },
  NEXT_PUBLIC_POSTHOG_HOST: {
    type: 'url',
    required: false,
    description: 'PostHog host for client-side SDK.',
    example: 'https://eu.posthog.com',
  },
  FLY_API_TOKEN: {
    type: 'string',
    required: false,
    description: 'Fly.io API token — stored as a GitHub Actions secret, never committed.',
  },
  R2_BUCKET: {
    type: 'string',
    required: false,
    description: 'Cloudflare R2 bucket name for database backups.',
    example: 'purechess-backups',
  },
  R2_ACCOUNT_ID: {
    type: 'string',
    required: false,
    description: 'Cloudflare account ID for R2.',
  },
  R2_ACCESS_KEY_ID: {
    type: 'string',
    required: false,
    description: 'R2 access key ID (S3-compatible).',
  },
  R2_SECRET_ACCESS_KEY: {
    type: 'string',
    required: false,
    description: 'R2 secret access key.',
  },
  R2_ENDPOINT: {
    type: 'url',
    required: false,
    description: 'R2 S3-compatible endpoint URL.',
    example: 'https://<account_id>.r2.cloudflarestorage.com',
  },
};

export type EnvKey = keyof typeof ENV_SCHEMA;

export const REQUIRED_KEYS = (Object.entries(ENV_SCHEMA) as [string, EnvVarDef][])
  .filter(([, def]) => def.required)
  .map(([key]) => key);
