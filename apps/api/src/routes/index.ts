import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';
import { meRoutes } from './me.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
}
