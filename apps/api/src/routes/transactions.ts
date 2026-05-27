import {
  CreateTransactionBody,
  TransactionKindSchema,
  TransactionListResponse,
  TransactionResponse,
  UpdateTransactionBody,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { transactionToDto } from '../lib/transaction-dto.js';

const ParamsId = z.object({ id: z.string().min(1) });

const ListQuery = z.object({
  wallet_id: z.string().min(1).optional(),
  kind: TransactionKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const transactionsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List transactions ─────────────────────────────────────────────────
  app.get(
    '/transactions',
    {
      schema: {
        tags: ['transactions'],
        summary: "List the current user's transactions",
        querystring: ListQuery,
        response: { 200: TransactionListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const { wallet_id, kind, limit } = req.query;
      const transactions = await app.db.transaction.findMany({
        where: {
          user_id: req.user.id,
          deleted_at: null,
          ...(wallet_id && {
            OR: [{ wallet_id }, { to_wallet_id: wallet_id }],
          }),
          ...(kind && { kind }),
        },
        orderBy: [{ transacted_at: 'desc' }, { created_at: 'desc' }],
        take: limit,
      });
      return ok({ transactions: transactions.map(transactionToDto) });
    }
  );

  // ─── Create transaction ────────────────────────────────────────────────
  app.post(
    '/transactions',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Create a new transaction',
        body: CreateTransactionBody,
        response: { 200: TransactionResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;

      // Verify wallet belongs to user
      const wallet = await app.db.wallet.findFirst({
        where: { id: body.wallet_id, user_id: req.user.id, deleted_at: null },
      });
      if (!wallet) {
        throw new AppError('transaction.not_found', 'Dompet tidak ditemukan.', 404);
      }

      // Verify to_wallet belongs to user (for transfers)
      if (body.to_wallet_id) {
        if (body.to_wallet_id === body.wallet_id) {
          throw new AppError(
            'validation.failed',
            'Dompet tujuan tidak boleh sama dengan dompet sumber.',
            400
          );
        }
        const toWallet = await app.db.wallet.findFirst({
          where: { id: body.to_wallet_id, user_id: req.user.id, deleted_at: null },
        });
        if (!toWallet) {
          throw new AppError('transaction.not_found', 'Dompet tujuan tidak ditemukan.', 404);
        }
      }

      const transaction = await app.db.transaction.create({
        data: {
          user_id: req.user.id,
          kind: body.kind,
          wallet_id: body.wallet_id,
          to_wallet_id: body.to_wallet_id ?? null,
          category_id: body.category_id ?? null,
          amount: BigInt(body.amount),
          note: body.note ?? null,
          transacted_at: new Date(body.transacted_at),
        },
      });
      return ok({ transaction: transactionToDto(transaction) });
    }
  );

  // ─── Get one transaction ───────────────────────────────────────────────
  app.get(
    '/transactions/:id',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Get a single transaction',
        params: ParamsId,
        response: { 200: TransactionResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const transaction = await app.db.transaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!transaction) {
        throw new AppError('transaction.not_found', 'Transaksi tidak ditemukan.', 404);
      }
      return ok({ transaction: transactionToDto(transaction) });
    }
  );

  // ─── Update transaction ────────────────────────────────────────────────
  app.patch(
    '/transactions/:id',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Update a transaction',
        params: ParamsId,
        body: UpdateTransactionBody,
        response: { 200: TransactionResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.transaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('transaction.not_found', 'Transaksi tidak ditemukan.', 404);
      }

      const body = req.body;

      // Verify new wallet_id belongs to user if changed
      if (body.wallet_id) {
        const wallet = await app.db.wallet.findFirst({
          where: { id: body.wallet_id, user_id: req.user.id, deleted_at: null },
        });
        if (!wallet) {
          throw new AppError('transaction.not_found', 'Dompet tidak ditemukan.', 404);
        }
      }

      // Verify new to_wallet_id belongs to user if changed
      if (body.to_wallet_id) {
        const effectiveWalletId = body.wallet_id ?? existing.wallet_id;
        if (body.to_wallet_id === effectiveWalletId) {
          throw new AppError(
            'validation.failed',
            'Dompet tujuan tidak boleh sama dengan dompet sumber.',
            400
          );
        }
        const toWallet = await app.db.wallet.findFirst({
          where: { id: body.to_wallet_id, user_id: req.user.id, deleted_at: null },
        });
        if (!toWallet) {
          throw new AppError('transaction.not_found', 'Dompet tujuan tidak ditemukan.', 404);
        }
      }

      const updated = await app.db.transaction.update({
        where: { id: existing.id },
        data: {
          kind: body.kind,
          wallet_id: body.wallet_id,
          to_wallet_id: body.to_wallet_id,
          category_id: body.category_id,
          amount: body.amount !== undefined ? BigInt(body.amount) : undefined,
          note: body.note,
          transacted_at:
            body.transacted_at !== undefined ? new Date(body.transacted_at) : undefined,
        },
      });
      return ok({ transaction: transactionToDto(updated) });
    }
  );

  // ─── Soft-delete transaction ───────────────────────────────────────────
  app.delete(
    '/transactions/:id',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Soft-delete a transaction',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.transaction.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('transaction.not_found', 'Transaksi tidak ditemukan.', 404);
      }
      await app.db.transaction.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );
};
