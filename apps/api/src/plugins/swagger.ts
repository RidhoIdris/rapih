import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import pkg from '../../package.json' with { type: 'json' };
import { loadEnv } from '../config/env.js';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  const env = loadEnv();

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Rapih API',
        description: 'Backend HTTP API for the Rapih personal-finance app.',
        version: pkg.version,
      },
      servers: [{ url: env.API_PUBLIC_URL }],
      tags: [
        { name: 'meta', description: 'Service health and metadata.' },
        { name: 'auth', description: 'Authentication endpoints (added in api-auth-email chunk).' },
        { name: 'me', description: 'Current-user endpoints (added in api-auth-email chunk).' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  if (env.NODE_ENV !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  } else {
    // In production, expose only the JSON spec without the UI.
    app.route({
      method: 'GET',
      url: '/docs/json',
      schema: { hide: true },
      handler: async () => app.swagger(),
    });
  }
}
