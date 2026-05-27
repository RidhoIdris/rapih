import { ReceiptListResponse, ReceiptResponse, UpdateReceiptBody } from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { receiptToDto } from '../lib/receipt-dto.js';
import { uploadReceiptImage } from '../lib/storage.js';

const ParamsId = z.object({ id: z.string().min(1) });

export const receiptsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── List ──────────────────────────────────────────────────────────────
  app.get(
    '/receipts',
    {
      schema: {
        tags: ['receipts'],
        summary: "List the current user's receipts",
        response: { 200: ReceiptListResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const rows = await app.db.receipt.findMany({
        where: { user_id: req.user.id, deleted_at: null },
        orderBy: { scanned_at: 'desc' },
      });
      return ok({ receipts: rows.map(receiptToDto) });
    }
  );

  // ─── Create (multipart) ────────────────────────────────────────────────
  app.post(
    '/receipts',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Create a receipt (multipart/form-data; image optional)',
        // Declare the response shape but leave body untyped (multipart)
        response: { 200: ReceiptResponse },
        // Hide body from Swagger auto-gen; document manually below
        consumes: ['multipart/form-data'],
      } as Parameters<typeof app.post>[1]['schema'],
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      let imageUrl: string | null = null;
      let merchantName: string | null = null;
      let totalAmount: string | null = null;
      let scannedAt: string | null = null;

      for await (const part of req.parts()) {
        if (part.type === 'file' && part.fieldname === 'image') {
          const buffer = Buffer.from(await part.toBuffer());
          imageUrl = await uploadReceiptImage(
            buffer,
            part.filename ?? 'receipt.jpg',
            part.mimetype
          );
        } else if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'merchant_name') merchantName = val || null;
          else if (part.fieldname === 'total_amount') totalAmount = val || null;
          else if (part.fieldname === 'scanned_at') scannedAt = val;
        }
      }

      if (!scannedAt) {
        throw new AppError('validation.failed', 'scanned_at is required.', 400);
      }
      const scannedDate = new Date(scannedAt);
      if (Number.isNaN(scannedDate.getTime())) {
        throw new AppError('validation.failed', 'scanned_at must be a valid datetime.', 400);
      }

      let parsedTotal: bigint | null = null;
      if (totalAmount !== null) {
        try {
          parsedTotal = BigInt(totalAmount);
          if (parsedTotal <= 0n) throw new Error();
        } catch {
          throw new AppError(
            'validation.failed',
            'total_amount must be a positive integer string.',
            400
          );
        }
      }

      const row = await app.db.receipt.create({
        data: {
          user_id: req.user.id,
          image_url: imageUrl,
          merchant_name: merchantName,
          total_amount: parsedTotal,
          scanned_at: scannedDate,
        },
      });
      return ok({ receipt: receiptToDto(row) });
    }
  );

  // ─── Get one ───────────────────────────────────────────────────────────
  app.get(
    '/receipts/:id',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Get a single receipt',
        params: ParamsId,
        response: { 200: ReceiptResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const row = await app.db.receipt.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!row) {
        throw new AppError('receipt.not_found', 'Struk tidak ditemukan.', 404);
      }
      return ok({ receipt: receiptToDto(row) });
    }
  );

  // ─── Update (JSON) ─────────────────────────────────────────────────────
  app.patch(
    '/receipts/:id',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Update receipt metadata (JSON)',
        params: ParamsId,
        body: UpdateReceiptBody,
        response: { 200: ReceiptResponse },
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req) => {
      const existing = await app.db.receipt.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('receipt.not_found', 'Struk tidak ditemukan.', 404);
      }

      const body = req.body;
      const updated = await app.db.receipt.update({
        where: { id: existing.id },
        data: {
          merchant_name: body.merchant_name,
          total_amount: body.total_amount !== undefined ? BigInt(body.total_amount) : undefined,
          scanned_at: body.scanned_at !== undefined ? new Date(body.scanned_at) : undefined,
        },
      });
      return ok({ receipt: receiptToDto(updated) });
    }
  );

  // ─── Soft-delete ───────────────────────────────────────────────────────
  app.delete(
    '/receipts/:id',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Soft-delete a receipt',
        params: ParamsId,
      },
      onRequest: [app.authenticate, app.requireOnboarding],
    },
    async (req, reply) => {
      const existing = await app.db.receipt.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      });
      if (!existing) {
        throw new AppError('receipt.not_found', 'Struk tidak ditemukan.', 404);
      }
      await app.db.receipt.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });
      reply.code(204).send();
    }
  );
};
