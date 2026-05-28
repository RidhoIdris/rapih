import {
  advanceDueDate,
  CreateRecurringBody,
  RecurringListResponse,
  RecurringResponse,
  UpdateRecurringBody,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { recurringToDto } from '../lib/recurring-dto.js';

const ParamsId = z.object({ id: z.string().min(1) });

export const recurringRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List ──────────────────────────────────────────────────────────────
  app.get(
    '/recurring',
    {
      schema: {
        tags: ['recurring'],
        summary: "List the current user's recurring transactions",
        response: { 200: RecurringListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const rows = await app.db.recurringTransaction.findMany({
        where: { user_id: req.user.id, deleted_at: null },
        orderBy: { next_due_date: 'asc' },
      });
      return ok({ recurring: rows.map(recurringToDto) });
    }
  );

  // ─── Create ────────────────────────────────────────────────────────────
  app.post(
    '/recurring',
    {
      schema: {
        tags: ['recurring'],
        summary: 'Create a new recurring transaction',
        body: CreateRecurringBody,
        response: { 200: RecurringResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;

      const wallet = await app.db.wallet.findFirst({
        where: { id: body.wallet_id, user_id: req.user.id, deleted_at: null },
      });
      if (!wallet) {
        throw new AppError('wallet.not_found', 'Dompet tidak ditemukan.', 404);
      }

      if (body.category_id) {
        const category = await app.db.category.findFirst({
          where: {
            id: body.category_id,
            deleted_at: null,
            OR: [{ user_id: req.user.id }, { user_id: null }],
          },
        });
        if (!category) {
          throw new AppError('category.not_found', 'Kategori tidak ditemukan.', 404);
        }
      }

      const row = await app.db.recurringTransaction.create({
        data: {
          user_id: req.user.id,
          wallet_id: body.wallet_id,
          category_id: body.category_id ?? null,
          kind: body.kind,
          amount: BigInt(body.amount),
          note: body.note ?? null,
          name: body.name,
          icon: body.icon,
          color: body.color,
          period: body.period,
          next_due_date: new Date(body.next_due_date),
        },
      });
      return ok({ recurring: recurringToDto(row) });
    }
  );

  // ─── Get one ───────────────────────────────────────────────────────────
  app.get(
    '/recurring/:id',
    {
      schema: {
        tags: ['recurring'],
        summary: 'Get a single recurring transaction',
        params: ParamsId,
        response: { 200: RecurringResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const row = await app.db.recurringTransaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!row) {
        throw new AppError('recurring.not_found', 'Tagihan rutin tidak ditemukan.', 404);
      }
      return ok({ recurring: recurringToDto(row) });
    }
  );

  // ─── Update ────────────────────────────────────────────────────────────
  app.patch(
    '/recurring/:id',
    {
      schema: {
        tags: ['recurring'],
        summary: 'Update a recurring transaction',
        params: ParamsId,
        body: UpdateRecurringBody,
        response: { 200: RecurringResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.recurringTransaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('recurring.not_found', 'Tagihan rutin tidak ditemukan.', 404);
      }

      const body = req.body;

      if (body.wallet_id) {
        const wallet = await app.db.wallet.findFirst({
          where: { id: body.wallet_id, user_id: req.user.id, deleted_at: null },
        });
        if (!wallet) {
          throw new AppError('wallet.not_found', 'Dompet tidak ditemukan.', 404);
        }
      }

      if (body.category_id) {
        const category = await app.db.category.findFirst({
          where: {
            id: body.category_id,
            deleted_at: null,
            OR: [{ user_id: req.user.id }, { user_id: null }],
          },
        });
        if (!category) {
          throw new AppError('category.not_found', 'Kategori tidak ditemukan.', 404);
        }
      }

      const updated = await app.db.recurringTransaction.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          icon: body.icon,
          color: body.color,
          wallet_id: body.wallet_id,
          category_id: body.category_id,
          amount: body.amount !== undefined ? BigInt(body.amount) : undefined,
          note: body.note,
          period: body.period,
          next_due_date:
            body.next_due_date !== undefined ? new Date(body.next_due_date) : undefined,
        },
      });
      return ok({ recurring: recurringToDto(updated) });
    }
  );

  // ─── Soft-delete ───────────────────────────────────────────────────────
  app.delete(
    '/recurring/:id',
    {
      schema: {
        tags: ['recurring'],
        summary: 'Soft-delete a recurring transaction',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.recurringTransaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('recurring.not_found', 'Tagihan rutin tidak ditemukan.', 404);
      }
      await app.db.recurringTransaction.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );

  // ─── Mark as paid ──────────────────────────────────────────────────────
  app.post(
    '/recurring/:id/pay',
    {
      schema: {
        tags: ['recurring'],
        summary: 'Mark a recurring transaction as paid (creates a real transaction)',
        params: ParamsId,
        response: { 200: RecurringResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.recurringTransaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('recurring.not_found', 'Tagihan rutin tidak ditemukan.', 404);
      }

      const now = new Date();
      const nextDue = advanceDueDate(existing.next_due_date, existing.period);

      const [, updated] = await app.db.$transaction([
        app.db.transaction.create({
          data: {
            user_id: req.user.id,
            wallet_id: existing.wallet_id,
            category_id: existing.category_id,
            kind: existing.kind,
            amount: existing.amount,
            note: existing.note,
            transacted_at: now,
          },
        }),
        app.db.recurringTransaction.update({
          where: { id: existing.id },
          data: { last_paid_at: now, next_due_date: nextDue },
        }),
      ]);

      return ok({ recurring: recurringToDto(updated) });
    }
  );
};
