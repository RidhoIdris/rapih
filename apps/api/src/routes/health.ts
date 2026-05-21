import type { FastifyInstance } from 'fastify';
import pkg from '../../package.json' with { type: 'json' };
import { ok } from '../lib/envelope.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ok({ service: 'api' as const, version: pkg.version }));
}
