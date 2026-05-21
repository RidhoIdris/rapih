import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import pkg from '../../package.json' with { type: 'json' };
import { ok } from '../lib/envelope.js';

const HealthResponse = z.object({
  ok: z.literal(true),
  data: z.object({
    service: z.literal('api'),
    version: z.string(),
  }),
});

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['meta'],
        summary: 'Service health & version',
        response: { 200: HealthResponse },
      },
    },
    async () => ok({ service: 'api' as const, version: pkg.version })
  );
};
