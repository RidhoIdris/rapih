import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
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
