import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './lib/errors.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
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
  await registerSwagger(app);

  registerErrorHandler(app, { nodeEnv: env.NODE_ENV });
  await registerRoutes(app);

  return app;
}
