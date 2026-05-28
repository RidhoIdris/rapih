import './helpers/test-env.js';
import { type Job, Queue } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { handleOcrReceipt, type OcrReceiptPayload } from '../src/handlers/ocr-receipt.js';
import { computeCost } from '../src/lib/cost.js';
import { __setOpenAiForTests } from '../src/lib/openai.js';
import { __setR2DownloadForTests } from '../src/lib/r2.js';
import { closeRedis } from '../src/lib/redis.js';
import { closeReminderQueue } from '../src/queues/reminder.js';
import { buildOpenAiCompletionMock } from './helpers/openai-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis, getTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

function buildJob(payload: OcrReceiptPayload): Job<OcrReceiptPayload> {
  return { data: payload } as unknown as Job<OcrReceiptPayload>;
}

async function seedUser() {
  return prisma.user.create({
    data: {
      email: `ocr-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      tier: 'plus',
      onboarding_completed_at: new Date(),
    },
  });
}

async function seedScan(userId: string, status: 'processing' | 'ready' = 'processing') {
  return prisma.receiptScan.create({
    data: {
      user_id: userId,
      source: 'in_app',
      status,
      r2_key: `users/${userId}/receipts/scan.jpg`,
      content_type: 'image/jpeg',
      size_bytes: 100,
    },
  });
}

async function reminderJobs() {
  const queue = new Queue('reminder', { connection: getTestRedis() });
  try {
    return await queue.getJobs(['waiting', 'delayed', 'active']);
  } finally {
    await queue.close();
  }
}

const VALID_OCR = {
  merchant: 'Warung',
  transacted_at: '2026-05-29',
  subtotal: 25000,
  tax: 2500,
  service_charge: null,
  discount: null,
  total: 27500,
  currency: 'IDR',
  items: [{ name: 'Nasi', qty: 1, unit_price: 25000, subtotal: 25000 }],
  confidence: 'high',
};

describe('ocr-receipt handler', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
    __setR2DownloadForTests(async () => ({ b64: 'ZmFrZQ==', contentType: 'image/jpeg' }));
    __setOpenAiForTests(undefined);
  });

  afterAll(async () => {
    __setR2DownloadForTests(undefined);
    __setOpenAiForTests(undefined);
    await closeReminderQueue();
    await closeRedis();
    await closeTestDb();
    await closeTestRedis();
  });

  it('happy path: marks scan ready, logs usage, and enqueues ready push', async () => {
    const user = await seedUser();
    const scan = await seedScan(user.id);
    __setOpenAiForTests(
      buildOpenAiCompletionMock([
        {
          content: JSON.stringify(VALID_OCR),
          usage: { prompt_tokens: 100, completion_tokens: 25 },
        },
      ])
    );

    await handleOcrReceipt(buildJob({ user_id: user.id, scan_id: scan.id }));

    const updated = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(updated.status).toBe('ready');
    expect(updated.ocr_result).toEqual(VALID_OCR);

    const usage = await prisma.aiUsageLog.findFirstOrThrow({ where: { user_id: user.id } });
    expect(usage.kind).toBe('ocr');
    expect(usage.prompt_tokens).toBe(100);
    expect(usage.completion_tokens).toBe(25);
    expect(usage.total_tokens).toBe(125);
    expect(usage.cost_usd.toString()).toBe(computeCost('gpt-4o-mini', 100, 25).toString());

    const jobs = await reminderJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe('receipts.ready-push');
    expect(jobs[0]?.data).toEqual({ user_id: user.id, scan_id: scan.id });
  });

  it('malformed JSON marks failed with parse_failed and enqueues failed push', async () => {
    const user = await seedUser();
    const scan = await seedScan(user.id);
    __setOpenAiForTests(
      buildOpenAiCompletionMock([
        { content: 'not json{{', usage: { prompt_tokens: 10, completion_tokens: 5 } },
      ])
    );

    await handleOcrReceipt(buildJob({ user_id: user.id, scan_id: scan.id }));

    const updated = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(updated.status).toBe('failed');
    expect(updated.failed_reason).toBe('parse_failed');
    const jobs = await reminderJobs();
    expect(jobs[0]?.name).toBe('receipts.failed-push');
    expect(jobs[0]?.data).toEqual({
      user_id: user.id,
      scan_id: scan.id,
      reason: 'parse_failed',
    });
  });

  it('zod validation failure marks parse_failed', async () => {
    const user = await seedUser();
    const scan = await seedScan(user.id);
    __setOpenAiForTests(
      buildOpenAiCompletionMock([
        {
          content: JSON.stringify({ merchant: 'No total' }),
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      ])
    );

    await handleOcrReceipt(buildJob({ user_id: user.id, scan_id: scan.id }));

    const updated = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(updated.status).toBe('failed');
    expect(updated.failed_reason).toBe('parse_failed');
  });

  it('wrong state is idempotent and does not enqueue a job', async () => {
    const user = await seedUser();
    const scan = await seedScan(user.id, 'ready');

    await handleOcrReceipt(buildJob({ user_id: user.id, scan_id: scan.id }));

    const updated = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(updated.status).toBe('ready');
    expect(await reminderJobs()).toHaveLength(0);
  });

  it('deleted scan throws scan_not_found and sends no push', async () => {
    const user = await seedUser();
    const scan = await seedScan(user.id);
    await prisma.receiptScan.update({
      where: { id: scan.id },
      data: { deleted_at: new Date() },
    });

    await expect(
      handleOcrReceipt(buildJob({ user_id: user.id, scan_id: scan.id }))
    ).rejects.toThrow('scan_not_found');
    expect(await reminderJobs()).toHaveLength(0);
  });

  it('OpenAI errors mark failed with internal, enqueue failed push, and rethrow', async () => {
    const user = await seedUser();
    const scan = await seedScan(user.id);
    __setOpenAiForTests({
      chat: { completions: { create: async () => Promise.reject(new Error('openai down')) } },
    } as never);

    await expect(
      handleOcrReceipt(buildJob({ user_id: user.id, scan_id: scan.id }))
    ).rejects.toThrow('openai down');
    const updated = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(updated.status).toBe('failed');
    expect(updated.failed_reason).toBe('internal');
    const jobs = await reminderJobs();
    expect(jobs[0]?.name).toBe('receipts.failed-push');
    expect(jobs[0]?.data.reason).toBe('internal');
  });
});
