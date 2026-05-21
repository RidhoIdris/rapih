import { createPrismaClient, type PrismaClient } from '@rapih/db';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { loadEnv } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

const dbPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const env = loadEnv();
  const prisma = createPrismaClient({
    databaseUrl: env.DATABASE_URL,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  await prisma.$connect();
  app.decorate('db', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(dbPlugin, { name: 'db' });
