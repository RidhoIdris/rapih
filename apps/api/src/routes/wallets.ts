import {
  CreateWalletBody,
  UpdateWalletBody,
  WalletListResponse,
  WalletResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { walletToDto } from '../lib/wallet-dto.js';

const ParamsId = z.object({ id: z.string().min(1) });

export const walletsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List wallets ──────────────────────────────────────────────────────
  app.get(
    '/wallets',
    {
      schema: {
        tags: ['wallets'],
        summary: "List the current user's wallets",
        response: { 200: WalletListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const wallets = await app.db.wallet.findMany({
        where: { user_id: req.user.id, deleted_at: null },
        orderBy: { created_at: 'asc' },
      });
      return ok({ wallets: wallets.map(walletToDto) });
    }
  );

  // ─── Create wallet ─────────────────────────────────────────────────────
  app.post(
    '/wallets',
    {
      schema: {
        tags: ['wallets'],
        summary: 'Create a new wallet',
        body: CreateWalletBody,
        response: { 200: WalletResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const body = req.body;
      const wallet = await app.db.wallet.create({
        data: {
          user_id: req.user.id,
          kind: body.kind,
          provider_name: body.provider_name,
          label: body.label ?? null,
          initial_balance: BigInt(body.initial_balance),
        },
      });
      return ok({ wallet: walletToDto(wallet) });
    }
  );

  // ─── Get one wallet ────────────────────────────────────────────────────
  app.get(
    '/wallets/:id',
    {
      schema: {
        tags: ['wallets'],
        summary: 'Get a single wallet',
        params: ParamsId,
        response: { 200: WalletResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const wallet = await app.db.wallet.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!wallet) {
        throw new AppError('wallet.not_found', 'Dompet tidak ditemukan.', 404);
      }
      return ok({ wallet: walletToDto(wallet) });
    }
  );

  // ─── Update wallet ─────────────────────────────────────────────────────
  app.patch(
    '/wallets/:id',
    {
      schema: {
        tags: ['wallets'],
        summary: 'Update a wallet (any non-empty subset of fields)',
        params: ParamsId,
        body: UpdateWalletBody,
        response: { 200: WalletResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.wallet.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('wallet.not_found', 'Dompet tidak ditemukan.', 404);
      }
      const body = req.body;
      const updated = await app.db.wallet.update({
        where: { id: existing.id },
        data: {
          kind: body.kind,
          provider_name: body.provider_name,
          label: body.label,
          initial_balance:
            body.initial_balance !== undefined ? BigInt(body.initial_balance) : undefined,
        },
      });
      return ok({ wallet: walletToDto(updated) });
    }
  );

  // ─── Soft-delete wallet ────────────────────────────────────────────────
  app.delete(
    '/wallets/:id',
    {
      schema: {
        tags: ['wallets'],
        summary: 'Soft-delete a wallet',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.wallet.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('wallet.not_found', 'Dompet tidak ditemukan.', 404);
      }
      await app.db.wallet.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );
};
