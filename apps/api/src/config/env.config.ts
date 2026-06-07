import Joi from 'joi';

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  SESSION_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_API_URL: string;
  OAUTH_GOOGLE_CLIENT_ID: string;
  OAUTH_GOOGLE_CLIENT_SECRET: string;
  OAUTH_GOOGLE_CALLBACK_URL: string;
  OAUTH_APPLE_CLIENT_ID: string;
  OAUTH_APPLE_TEAM_ID: string;
  OAUTH_APPLE_KEY_ID: string;
  OAUTH_APPLE_PRIVATE_KEY: string;
  OAUTH_APPLE_CALLBACK_URL: string;
  SENTRY_DSN: string;
  SENTRY_ENV: string;
  POSTHOG_API_KEY: string;
  POSTHOG_HOST: string;
  WEB_URL: string;
}

export const envValidationSchema = Joi.object<EnvConfig>({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  SESSION_SECRET: Joi.string().min(32).required(),
  NEXT_PUBLIC_APP_URL: Joi.string().uri().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: Joi.string().uri().default('http://localhost:4000'),
  OAUTH_GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  OAUTH_GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  OAUTH_GOOGLE_CALLBACK_URL: Joi.string().uri().default('http://localhost:4000/api/auth/oauth/google/callback'),
  OAUTH_APPLE_CLIENT_ID: Joi.string().allow('').default(''),
  OAUTH_APPLE_TEAM_ID: Joi.string().allow('').default(''),
  OAUTH_APPLE_KEY_ID: Joi.string().allow('').default(''),
  OAUTH_APPLE_PRIVATE_KEY: Joi.string().allow('').default(''),
  OAUTH_APPLE_CALLBACK_URL: Joi.string().uri().default('http://localhost:4000/api/auth/oauth/apple/callback'),
  SENTRY_DSN: Joi.string().uri().optional().allow('').default(''),
  SENTRY_ENV: Joi.string().optional().default('development'),
  POSTHOG_API_KEY: Joi.string().optional().allow('').default(''),
  POSTHOG_HOST: Joi.string().uri().optional().default('https://eu.posthog.com'),
  WEB_URL: Joi.string().uri().default('http://localhost:3000'),
});
