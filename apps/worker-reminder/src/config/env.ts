import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  TZ: z.string().default('Asia/Jakarta'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
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
