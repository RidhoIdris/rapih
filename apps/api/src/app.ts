import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import authDecorators from './auth/decorators.js';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './lib/errors.js';
import dbPlugin from './plugins/db.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerRoutes } from './routes/index.js';

/**
 * Build the Fastify app with all plugins registered but NOT yet ready().
 * Use this when you need to add routes before calling ready() (e.g. tests).
 */
export async function buildRawApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  const isDev = env.NODE_ENV === 'development';

  const app = Fastify({
    logger: isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : env.NODE_ENV !== 'test',
    disableRequestLogging: env.NODE_ENV === 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, { origin: [env.APP_PUBLIC_URL], credentials: true });
  await app.register(dbPlugin);
  await app.register(authDecorators);
  await registerSwagger(app);

  registerErrorHandler(app, { nodeEnv: env.NODE_ENV });
  await registerRoutes(app);

  return app;
}

/**
 * Build and initialize the Fastify app (calls ready() internally).
 * Use this for production and most tests.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = await buildRawApp();
  await app.ready();
  return app;
}
