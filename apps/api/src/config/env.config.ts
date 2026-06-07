import Joi from 'joi';

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  NEXT_PUBLIC_APP_URL: string;
  OAUTH_GOOGLE_CLIENT_ID: string;
  OAUTH_GOOGLE_CLIENT_SECRET: string;
  OAUTH_APPLE_CLIENT_ID: string;
  OAUTH_APPLE_CLIENT_SECRET: string;
}

export const envValidationSchema = Joi.object<EnvConfig>({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRY: Joi.string().default('7d'),
  NEXT_PUBLIC_APP_URL: Joi.string().uri().default('http://localhost:3000'),
  OAUTH_GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  OAUTH_GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  OAUTH_APPLE_CLIENT_ID: Joi.string().allow('').default(''),
  OAUTH_APPLE_CLIENT_SECRET: Joi.string().allow('').default(''),
});
