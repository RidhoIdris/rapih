import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const CommaList = z
  .string()
  .min(1)
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
  )
  .refine((arr) => arr.length > 0, { message: 'must contain at least one value' });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),

  GOOGLE_OAUTH_CLIENT_IDS: CommaList,
  APPLE_OAUTH_CLIENT_IDS: CommaList,

  // Cloudflare R2 — optional; if absent, image uploads are silently skipped
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let dotenvLoaded = false;

export function loadEnv(): Env {
  if (!dotenvLoaded && process.env.NODE_ENV !== 'production') {
    loadDotenv();
    dotenvLoaded = true;
  }

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
