import { CreateGoalBody, GoalListResponse, GoalResponse, UpdateGoalBody } from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { goalToDto } from '../lib/goal-dto.js';

const ParamsId = z.object({ id: z.string().min(1) });

export const goalsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List goals ────────────────────────────────────────────────────────
  app.get(
    '/goals',
    {
      schema: {
        tags: ['goals'],
        summary: "List the current user's goals",
        response: { 200: GoalListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const goals = await app.db.goal.findMany({
        where: { user_id: req.user.id, deleted_at: null },
        orderBy: { created_at: 'asc' },
      });
      return ok({ goals: goals.map(goalToDto) });
    }
  );

  // ─── Create goal ───────────────────────────────────────────────────────
  app.post(
    '/goals',
    {
      schema: {
        tags: ['goals'],
        summary: 'Create a new goal',
        body: CreateGoalBody,
        response: { 200: GoalResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;

      if (body.wallet_id) {
        const wallet = await app.db.wallet.findFirst({
          where: { id: body.wallet_id, user_id: req.user.id, deleted_at: null },
        });
        if (!wallet) {
          throw new AppError('goal.not_found', 'Dompet tidak ditemukan.', 404);
        }
      }

      const goal = await app.db.goal.create({
        data: {
          user_id: req.user.id,
          name: body.name,
          icon: body.icon,
          color: body.color,
          target_amount: BigInt(body.target_amount),
          saved_amount: body.saved_amount ? BigInt(body.saved_amount) : 0n,
          deadline: body.deadline ? new Date(body.deadline) : null,
          wallet_id: body.wallet_id ?? null,
        },
      });
      return ok({ goal: goalToDto(goal) });
    }
  );

  // ─── Get one goal ──────────────────────────────────────────────────────
  app.get(
    '/goals/:id',
    {
      schema: {
        tags: ['goals'],
        summary: 'Get a single goal',
        params: ParamsId,
        response: { 200: GoalResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const goal = await app.db.goal.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!goal) {
        throw new AppError('goal.not_found', 'Goal tidak ditemukan.', 404);
      }
      return ok({ goal: goalToDto(goal) });
    }
  );

  // ─── Update goal ───────────────────────────────────────────────────────
  app.patch(
    '/goals/:id',
    {
      schema: {
        tags: ['goals'],
        summary: 'Update a goal',
        params: ParamsId,
        body: UpdateGoalBody,
        response: { 200: GoalResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.goal.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('goal.not_found', 'Goal tidak ditemukan.', 404);
      }

      const body = req.body;

      if (body.wallet_id) {
        const wallet = await app.db.wallet.findFirst({
          where: { id: body.wallet_id, user_id: req.user.id, deleted_at: null },
        });
        if (!wallet) {
          throw new AppError('goal.not_found', 'Dompet tidak ditemukan.', 404);
        }
      }

      const updated = await app.db.goal.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          icon: body.icon,
          color: body.color,
          target_amount: body.target_amount !== undefined ? BigInt(body.target_amount) : undefined,
          saved_amount: body.saved_amount !== undefined ? BigInt(body.saved_amount) : undefined,
          deadline:
            body.deadline !== undefined
              ? body.deadline
                ? new Date(body.deadline)
                : null
              : undefined,
          wallet_id: body.wallet_id,
        },
      });
      return ok({ goal: goalToDto(updated) });
    }
  );

  // ─── Soft-delete goal ──────────────────────────────────────────────────
  app.delete(
    '/goals/:id',
    {
      schema: {
        tags: ['goals'],
        summary: 'Soft-delete a goal',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.goal.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('goal.not_found', 'Goal tidak ditemukan.', 404);
      }
      await app.db.goal.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );
};
