import Fastify from 'fastify';
import { loadEnv } from './config/env.js';
import { handleTanyaChat } from './handlers/tanya-chat.js';
import { logger } from './lib/logger.js';
import { closePrisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';
import { closeAiQueue } from './queues/ai.js';
import { registerHandler, startWorker, stopWorker } from './worker.js';

async function main(): Promise<void> {
  const env = loadEnv();

  registerHandler('tanya.chat-completion', handleTanyaChat);

  startWorker();
  logger.info('worker started');

  const app = Fastify({ logger: false });
  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'health endpoint listening');

  const shutdown = async () => {
    logger.info('shutting down');
    await app.close();
    await stopWorker();
    await closeAiQueue();
    await closePrisma();
    await closeRedis();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal error in main');
  process.exit(1);
});
