import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  QR_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().default('Africa/Cairo'),
  DEFAULT_COUNTRY: z.string().default('EG'),
});

export type AppEnv = z.infer<typeof schema>;
export const validateEnv = (config: Record<string, unknown>): AppEnv => schema.parse(config);
