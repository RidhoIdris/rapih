import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { budgetsRoutes } from './budgets.js';
import { categoriesRoutes } from './categories.js';
import { devicesRoutes } from './devices.js';
import { goalsRoutes } from './goals.js';
import { healthRoutes } from './health.js';
import { homeRoutes } from './home.js';
import { meRoutes } from './me.js';
import { notificationsRoutes } from './notifications.js';
import { receiptsRoutes } from './receipts.js';
import { recurringRoutes } from './recurring.js';
import { tanyaRoutes } from './tanya.js';
import { transactionsRoutes } from './transactions.js';
import { walletsRoutes } from './wallets.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(homeRoutes);
  await app.register(walletsRoutes);
  await app.register(categoriesRoutes);
  await app.register(transactionsRoutes);
  await app.register(goalsRoutes);
  await app.register(recurringRoutes);
  await app.register(budgetsRoutes);
  await app.register(receiptsRoutes);
  await app.register(devicesRoutes);
  await app.register(notificationsRoutes);
  await app.register(tanyaRoutes);
}
