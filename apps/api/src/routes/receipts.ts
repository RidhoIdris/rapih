import type { Prisma, ReceiptScan } from '@rapih/db';
import {
  ConsumeBody,
  ConsumeResponse,
  CreateScanBody,
  CreateScanResponse,
  DeleteScanResponse,
  FinalizeScanResponse,
  ListScansResponse,
  ReceiptOcrResult,
  type ReceiptScanDto,
  ReceiptScanStatusSchema,
  ScanDetailResponse,
} from '@rapih/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { headObject, presignGet, presignPut } from '../lib/r2.js';
import { getAiQueue } from '../producers/ai-queue.js';

const ParamsId = z.object({ id: z.string().min(1) });

const ListQuery = z.object({
  status: ReceiptScanStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function toScanDto(row: ReceiptScan): ReceiptScanDto {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    content_type: row.content_type,
    size_bytes: row.size_bytes,
    ocr_result: row.ocr_result === null ? null : ReceiptOcrResult.parse(row.ocr_result),
    failed_reason: row.failed_reason,
    consumed_at: row.consumed_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

function extFromContentType(contentType: string): string | null {
  switch (contentType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return null;
  }
}

async function findOwnedScan(
  app: Parameters<FastifyPluginAsyncZod>[0],
  id: string,
  userId: string
) {
  const scan = await app.db.receiptScan.findFirst({
    where: { id, user_id: userId, deleted_at: null },
  });
  if (!scan) {
    throw new AppError('receipt.scan_not_found', 'Struk tidak ditemukan.', 404);
  }
  return scan;
}

async function assertWalletAndCategory(
  tx: Prisma.TransactionClient,
  opts: { categoryId: string; userId: string; walletId: string }
): Promise<void> {
  const wallet = await tx.wallet.findFirst({
    where: { id: opts.walletId, user_id: opts.userId, deleted_at: null },
  });
  if (!wallet) {
    throw new AppError('wallet.not_found', 'Dompet tidak ditemukan.', 404);
  }

  const category = await tx.category.findFirst({
    where: {
      id: opts.categoryId,
      kind: 'expense',
      deleted_at: null,
      OR: [{ user_id: opts.userId }, { user_id: null }],
    },
  });
  if (!category) {
    throw new AppError('category.not_found', 'Kategori tidak ditemukan.', 404);
  }
}

export const receiptsRoutes: FastifyPluginAsyncZod = async (app) => {
  const guards = [app.authenticate, app.requireOnboarding, app.requirePlus];

  app.post(
    '/receipts/scans',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Create a receipt scan and presigned upload URL',
        body: CreateScanBody,
        response: { 200: CreateScanResponse },
      },
      onRequest: guards,
    },
    async (req) => {
      const ext = extFromContentType(req.body.content_type);
      if (!ext) {
        throw new AppError('validation.failed', 'content_type tidak didukung.', 400);
      }

      const scan = await app.db.receiptScan.create({
        data: {
          user_id: req.user.id,
          source: req.body.source,
          content_type: req.body.content_type,
          size_bytes: req.body.size_bytes,
          r2_key: 'pending',
        },
      });
      const r2Key = `users/${req.user.id}/receipts/${scan.id}.${ext}`;
      const updated = await app.db.receiptScan.update({
        where: { id: scan.id },
        data: { r2_key: r2Key },
      });
      const upload = await presignPut(r2Key, req.body.content_type, req.body.size_bytes);
      return ok({ scan: toScanDto(updated), upload });
    }
  );

  app.post(
    '/receipts/scans/:id/finalize',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Finalize an uploaded receipt scan and enqueue OCR',
        params: ParamsId,
        response: { 200: FinalizeScanResponse },
      },
      onRequest: guards,
    },
    async (req) => {
      const scan = await findOwnedScan(app, req.params.id, req.user.id);
      if (scan.status !== 'pending') {
        throw new AppError('receipt.invalid_state', 'Struk tidak dalam status yang valid.', 409);
      }

      const head = await headObject(scan.r2_key);
      if (!head.exists) {
        throw new AppError('receipt.upload_missing', 'Upload struk belum selesai.', 409);
      }
      if (head.size !== scan.size_bytes) {
        throw new AppError('receipt.invalid_state', 'Ukuran upload tidak cocok.', 409);
      }

      const updated = await app.db.receiptScan.update({
        where: { id: scan.id },
        data: { status: 'processing' },
      });
      await getAiQueue().add(
        'ai.ocr-receipt',
        { user_id: req.user.id, scan_id: scan.id },
        { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } }
      );
      return ok({ scan: toScanDto(updated) });
    }
  );

  app.get(
    '/receipts/scans',
    {
      schema: {
        tags: ['receipts'],
        summary: "List the current user's receipt scans",
        querystring: ListQuery,
        response: { 200: ListScansResponse },
      },
      onRequest: guards,
    },
    async (req) => {
      const rows = await app.db.receiptScan.findMany({
        where: {
          user_id: req.user.id,
          deleted_at: null,
          ...(req.query.status && { status: req.query.status }),
        },
        orderBy: { created_at: 'desc' },
        take: req.query.limit,
      });
      return ok({ scans: rows.map(toScanDto) });
    }
  );

  app.get(
    '/receipts/scans/:id',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Get a receipt scan with a temporary image URL',
        params: ParamsId,
        response: { 200: ScanDetailResponse },
      },
      onRequest: guards,
    },
    async (req) => {
      const scan = await findOwnedScan(app, req.params.id, req.user.id);
      const imageUrl = await presignGet(scan.r2_key, 300);
      return ok({ scan: toScanDto(scan), image_url: imageUrl });
    }
  );

  app.post(
    '/receipts/scans/:id/consume',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Consume a ready receipt scan into transactions',
        params: ParamsId,
        body: ConsumeBody,
        response: { 200: ConsumeResponse },
      },
      onRequest: guards,
    },
    async (req) => {
      const scan = await findOwnedScan(app, req.params.id, req.user.id);
      if (scan.status === 'consumed') {
        throw new AppError('receipt.already_consumed', 'Struk sudah disimpan.', 409);
      }
      if (scan.status !== 'ready') {
        throw new AppError('receipt.invalid_state', 'Struk tidak dalam status yang valid.', 409);
      }

      const transactionIds = await app.db.$transaction(async (tx) => {
        const created: string[] = [];

        if (req.body.mode === 'per_item') {
          for (const item of req.body.items) {
            await assertWalletAndCategory(tx, {
              userId: req.user.id,
              walletId: req.body.wallet_id,
              categoryId: item.category_id,
            });
            const row = await tx.transaction.create({
              data: {
                user_id: req.user.id,
                kind: 'expense',
                wallet_id: req.body.wallet_id,
                category_id: item.category_id,
                amount: BigInt(item.amount),
                note: item.note ?? item.name,
                transacted_at: new Date(item.transacted_at),
                receipt_scan_id: scan.id,
              },
            });
            created.push(row.id);
          }
        } else {
          await assertWalletAndCategory(tx, {
            userId: req.user.id,
            walletId: req.body.wallet_id,
            categoryId: req.body.category_id,
          });
          const row = await tx.transaction.create({
            data: {
              user_id: req.user.id,
              kind: 'expense',
              wallet_id: req.body.wallet_id,
              category_id: req.body.category_id,
              amount: BigInt(req.body.amount),
              note: req.body.note ?? req.body.merchant ?? 'Struk',
              transacted_at: new Date(req.body.transacted_at),
              receipt_scan_id: scan.id,
            },
          });
          created.push(row.id);
        }

        await tx.receiptScan.update({
          where: { id: scan.id },
          data: { status: 'consumed', consumed_at: new Date() },
        });
        return created;
      });

      return ok({ transaction_ids: transactionIds });
    }
  );

  app.delete(
    '/receipts/scans/:id',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Soft-delete a receipt scan',
        params: ParamsId,
        response: { 200: DeleteScanResponse },
      },
      onRequest: guards,
    },
    async (req) => {
      const result = await app.db.receiptScan.updateMany({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      if (result.count === 0) {
        throw new AppError('receipt.scan_not_found', 'Struk tidak ditemukan.', 404);
      }
      return { ok: true as const };
    }
  );
};
