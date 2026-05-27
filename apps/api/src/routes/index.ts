import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { budgetsRoutes } from './budgets.js';
import { categoriesRoutes } from './categories.js';
import { goalsRoutes } from './goals.js';
import { healthRoutes } from './health.js';
import { meRoutes } from './me.js';
import { receiptsRoutes } from './receipts.js';
import { recurringRoutes } from './recurring.js';
import { transactionsRoutes } from './transactions.js';
import { walletsRoutes } from './wallets.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(walletsRoutes);
  await app.register(categoriesRoutes);
  await app.register(transactionsRoutes);
  await app.register(goalsRoutes);
  await app.register(recurringRoutes);
  await app.register(budgetsRoutes);
  await app.register(receiptsRoutes);
}
