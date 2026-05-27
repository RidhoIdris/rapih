import {
  BudgetListResponse,
  BudgetResponse,
  CreateBudgetBody,
  UpdateBudgetBody,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { budgetToDto } from '../lib/budget-dto.js';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';

const ParamsId = z.object({ id: z.string().min(1) });

const BUDGET_INCLUDE = { budget_categories: { select: { category_id: true } } } as const;

function currentMonthRange(): { gte: Date; lt: Date } {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

async function computeSpent(
  app: Parameters<FastifyPluginAsyncZod>[0],
  userId: string,
  categoryIds: string[]
): Promise<bigint> {
  const result = await app.db.transaction.aggregate({
    where: {
      user_id: userId,
      deleted_at: null,
      kind: 'expense',
      transacted_at: currentMonthRange(),
      ...(categoryIds.length > 0 ? { category_id: { in: categoryIds } } : {}),
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0n;
}

async function validateCategoryIds(
  app: Parameters<FastifyPluginAsyncZod>[0],
  userId: string,
  categoryIds: string[]
): Promise<void> {
  if (categoryIds.length === 0) return;
  const found = await app.db.category.findMany({
    where: {
      id: { in: categoryIds },
      deleted_at: null,
      OR: [{ user_id: userId }, { user_id: null }],
    },
    select: { id: true },
  });
  if (found.length !== categoryIds.length) {
    throw new AppError('category.not_found', 'Satu atau lebih kategori tidak ditemukan.', 404);
  }
}

export const budgetsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List ──────────────────────────────────────────────────────────────
  app.get(
    '/budgets',
    {
      schema: {
        tags: ['budgets'],
        summary: "List the current user's budgets with current-month spent",
        response: { 200: BudgetListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const [budgets, expenses] = await Promise.all([
        app.db.budget.findMany({
          where: { user_id: req.user.id, deleted_at: null },
          include: BUDGET_INCLUDE,
          orderBy: { created_at: 'asc' },
        }),
        app.db.transaction.findMany({
          where: {
            user_id: req.user.id,
            deleted_at: null,
            kind: 'expense',
            transacted_at: currentMonthRange(),
          },
          select: { category_id: true, amount: true },
        }),
      ]);

      const result = budgets.map((b) => {
        const catSet = new Set(b.budget_categories.map((bc) => bc.category_id));
        const spent = expenses
          .filter((t) => catSet.size === 0 || (t.category_id !== null && catSet.has(t.category_id)))
          .reduce((acc, t) => acc + t.amount, 0n);
        return budgetToDto(b, spent);
      });

      return ok({ budgets: result });
    }
  );

  // ─── Create ────────────────────────────────────────────────────────────
  app.post(
    '/budgets',
    {
      schema: {
        tags: ['budgets'],
        summary: 'Create a new budget',
        body: CreateBudgetBody,
        response: { 200: BudgetResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;
      await validateCategoryIds(app, req.user.id, body.category_ids);

      const row = await app.db.budget.create({
        data: {
          user_id: req.user.id,
          name: body.name,
          icon: body.icon,
          color: body.color,
          amount: BigInt(body.amount),
          budget_categories: {
            createMany: { data: body.category_ids.map((id) => ({ category_id: id })) },
          },
        },
        include: BUDGET_INCLUDE,
      });

      const spent = await computeSpent(app, req.user.id, body.category_ids);
      return ok({ budget: budgetToDto(row, spent) });
    }
  );

  // ─── Get one ───────────────────────────────────────────────────────────
  app.get(
    '/budgets/:id',
    {
      schema: {
        tags: ['budgets'],
        summary: 'Get a single budget',
        params: ParamsId,
        response: { 200: BudgetResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const row = await app.db.budget.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        include: BUDGET_INCLUDE,
      });
      if (!row) {
        throw new AppError('budget.not_found', 'Budget tidak ditemukan.', 404);
      }
      const categoryIds = row.budget_categories.map((bc) => bc.category_id);
      const spent = await computeSpent(app, req.user.id, categoryIds);
      return ok({ budget: budgetToDto(row, spent) });
    }
  );

  // ─── Update ────────────────────────────────────────────────────────────
  app.patch(
    '/budgets/:id',
    {
      schema: {
        tags: ['budgets'],
        summary: 'Update a budget',
        params: ParamsId,
        body: UpdateBudgetBody,
        response: { 200: BudgetResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.budget.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        include: BUDGET_INCLUDE,
      });
      if (!existing) {
        throw new AppError('budget.not_found', 'Budget tidak ditemukan.', 404);
      }

      const body = req.body;
      if (body.category_ids) {
        await validateCategoryIds(app, req.user.id, body.category_ids);
      }

      const updated = await app.db.budget.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          icon: body.icon,
          color: body.color,
          amount: body.amount !== undefined ? BigInt(body.amount) : undefined,
          ...(body.category_ids !== undefined
            ? {
                budget_categories: {
                  deleteMany: {},
                  createMany: { data: body.category_ids.map((id) => ({ category_id: id })) },
                },
              }
            : {}),
        },
        include: BUDGET_INCLUDE,
      });

      const categoryIds = updated.budget_categories.map((bc) => bc.category_id);
      const spent = await computeSpent(app, req.user.id, categoryIds);
      return ok({ budget: budgetToDto(updated, spent) });
    }
  );

  // ─── Soft-delete ───────────────────────────────────────────────────────
  app.delete(
    '/budgets/:id',
    {
      schema: {
        tags: ['budgets'],
        summary: 'Soft-delete a budget',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.budget.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('budget.not_found', 'Budget tidak ditemukan.', 404);
      }
      await app.db.budget.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );
};
