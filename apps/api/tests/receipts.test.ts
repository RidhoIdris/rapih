import './helpers/mock-r2.js';
import './helpers/test-env.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { closeAiQueue } from '../src/producers/ai-queue.js';
import { mockR2 } from './helpers/mock-r2.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { flushTestRedis, getTestAiQueue, teardownTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

type Tier = 'free' | 'plus' | 'pro';

async function userWithToken(opts: { onboarded?: boolean; tier?: Tier } = {}) {
  const onboarded = opts.onboarded ?? true;
  const tier: Tier = opts.tier ?? 'plus';
  const user = await prisma.user.create({
    data: {
      email: `receipt-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      tier,
      onboarding_completed_at: onboarded ? new Date() : null,
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier,
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

async function seedWalletAndCategory(userId: string) {
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
  });
  const category = await prisma.category.create({
    data: {
      user_id: userId,
      kind: 'expense',
      name: 'Makan',
      color: '#10B981',
      icon: 'utensils',
    },
  });
  return { category, wallet };
}

describe('receipt scans', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
    mockR2.clear();
  });

  afterAll(async () => {
    await closeAiQueue();
    await app.close();
    await teardownTestRedis();
  });

  it('POST /receipts/scans returns 401 without bearer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      payload: { source: 'in_app', content_type: 'image/jpeg', size_bytes: 1234 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /receipts/scans returns 403 for Free user', async () => {
    const { token } = await userWithToken({ tier: 'free' });
    const res = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'in_app', content_type: 'image/jpeg', size_bytes: 1234 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('tier.upgrade_required');
  });

  it('POST /receipts/scans creates pending scan and presigned upload', async () => {
    const { token, user } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'in_app', content_type: 'image/jpeg', size_bytes: 1234 },
    });

    expect(res.statusCode).toBe(200);
    const { scan, upload } = res.json().data;
    expect(scan.status).toBe('pending');
    expect(upload.headers).toEqual({ 'Content-Type': 'image/jpeg', 'Content-Length': '1234' });

    const row = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(row.user_id).toBe(user.id);
    expect(row.r2_key).toBe(`users/${user.id}/receipts/${scan.id}.jpg`);
    expect(upload.url).toContain(encodeURIComponent(row.r2_key));
  });

  it('POST /receipts/scans rejects unsupported content type', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'in_app', content_type: 'application/pdf', size_bytes: 1234 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('POST /receipts/scans rejects images larger than 10MB', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'in_app', content_type: 'image/jpeg', size_bytes: 11 * 1024 * 1024 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('POST /receipts/scans/:id/finalize returns upload_missing before R2 object exists', async () => {
    const { token } = await userWithToken();
    const create = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'in_app', content_type: 'image/png', size_bytes: 999 },
    });
    const scanId = create.json().data.scan.id;

    const res = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${scanId}/finalize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('receipt.upload_missing');
  });

  it('POST /receipts/scans/:id/finalize moves to processing and enqueues OCR job', async () => {
    const { token, user } = await userWithToken();
    const create = await app.inject({
      method: 'POST',
      url: '/receipts/scans',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'in_app', content_type: 'image/png', size_bytes: 999 },
    });
    const scanId = create.json().data.scan.id;
    const row = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scanId } });
    mockR2.uploadFromKey(row.r2_key, 999, 'image/png');

    const res = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${scanId}/finalize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.scan.status).toBe('processing');

    const queue = getTestAiQueue();
    const jobs = await queue.getJobs(['waiting', 'delayed', 'active']);
    await queue.close();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe('ai.ocr-receipt');
    expect(jobs[0]?.data).toEqual({ user_id: user.id, scan_id: scanId });
  });

  it('POST /receipts/scans/:id/finalize rejects size mismatch and repeated finalize', async () => {
    const { token, user } = await userWithToken();
    const mismatch = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'pending',
        r2_key: `users/${user.id}/receipts/mismatch.jpg`,
        content_type: 'image/jpeg',
        size_bytes: 1000,
      },
    });
    mockR2.uploadFromKey(mismatch.r2_key, 1001, 'image/jpeg');
    const badSize = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${mismatch.id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(badSize.statusCode).toBe(409);
    expect(badSize.json().error.code).toBe('receipt.invalid_state');

    const processing = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'processing',
        r2_key: `users/${user.id}/receipts/processing.jpg`,
        content_type: 'image/jpeg',
        size_bytes: 1000,
      },
    });
    const repeated = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${processing.id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(repeated.statusCode).toBe(409);
    expect(repeated.json().error.code).toBe('receipt.invalid_state');
  });

  it('GET /receipts/scans lists own non-deleted scans with status filter', async () => {
    const { token, user } = await userWithToken();
    const other = await prisma.user.create({
      data: {
        email: 'other-receipt-scan@e.com',
        name: 'Other',
        tier: 'plus',
        onboarding_completed_at: new Date(),
      },
    });
    const ready = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'ready',
        r2_key: 'own-ready',
        content_type: 'image/jpeg',
        size_bytes: 1,
      },
    });
    await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        deleted_at: new Date(),
        r2_key: 'deleted',
        content_type: 'image/jpeg',
        size_bytes: 1,
      },
    });
    await prisma.receiptScan.create({
      data: {
        user_id: other.id,
        source: 'in_app',
        status: 'ready',
        r2_key: 'other',
        content_type: 'image/jpeg',
        size_bytes: 1,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/receipts/scans?status=ready',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.scans.map((s: { id: string }) => s.id)).toEqual([ready.id]);
  });

  it('GET /receipts/scans/:id returns scan and image_url, cross-user returns 404', async () => {
    const { token, user } = await userWithToken();
    const scan = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        r2_key: `users/${user.id}/receipts/detail.jpg`,
        content_type: 'image/jpeg',
        size_bytes: 100,
      },
    });
    const detail = await app.inject({
      method: 'GET',
      url: `/receipts/scans/${scan.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.image_url).toContain(encodeURIComponent(scan.r2_key));

    const other = await userWithToken();
    const crossUser = await app.inject({
      method: 'GET',
      url: `/receipts/scans/${scan.id}`,
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(crossUser.statusCode).toBe(404);
    expect(crossUser.json().error.code).toBe('receipt.scan_not_found');
  });

  it('POST /receipts/scans/:id/consume per_item creates linked transactions', async () => {
    const { token, user } = await userWithToken();
    const { category, wallet } = await seedWalletAndCategory(user.id);
    const scan = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'ready',
        r2_key: 'consume-per-item',
        content_type: 'image/jpeg',
        size_bytes: 100,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${scan.id}/consume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        mode: 'per_item',
        wallet_id: wallet.id,
        items: [
          {
            name: 'Nasi',
            amount: '25000',
            category_id: category.id,
            transacted_at: '2026-05-29T01:00:00.000Z',
          },
          {
            name: 'Es teh',
            amount: '5000',
            category_id: category.id,
            transacted_at: '2026-05-29T01:00:00.000Z',
            note: 'Minum',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transaction_ids).toHaveLength(2);
    expect(await prisma.transaction.count({ where: { receipt_scan_id: scan.id } })).toBe(2);
    const updated = await prisma.receiptScan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(updated.status).toBe('consumed');
    expect(updated.consumed_at).not.toBeNull();
  });

  it('POST /receipts/scans/:id/consume total creates one transaction and rejects repeats', async () => {
    const { token, user } = await userWithToken();
    const { category, wallet } = await seedWalletAndCategory(user.id);
    const scan = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'ready',
        r2_key: 'consume-total',
        content_type: 'image/jpeg',
        size_bytes: 100,
      },
    });

    const first = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${scan.id}/consume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        mode: 'total',
        wallet_id: wallet.id,
        category_id: category.id,
        amount: '30000',
        transacted_at: '2026-05-29T01:00:00.000Z',
        merchant: 'Warung',
      },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.transaction_ids).toHaveLength(1);

    const repeated = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${scan.id}/consume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        mode: 'total',
        wallet_id: wallet.id,
        category_id: category.id,
        amount: '30000',
        transacted_at: '2026-05-29T01:00:00.000Z',
      },
    });
    expect(repeated.statusCode).toBe(409);
    expect(repeated.json().error.code).toBe('receipt.already_consumed');
  });

  it('POST /receipts/scans/:id/consume rejects wrong state and foreign wallet', async () => {
    const { token, user } = await userWithToken();
    const other = await userWithToken();
    const { category } = await seedWalletAndCategory(user.id);
    const { wallet: foreignWallet } = await seedWalletAndCategory(other.user.id);
    const pending = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'pending',
        r2_key: 'pending',
        content_type: 'image/jpeg',
        size_bytes: 100,
      },
    });
    const ready = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        status: 'ready',
        r2_key: 'ready-foreign-wallet',
        content_type: 'image/jpeg',
        size_bytes: 100,
      },
    });

    const wrongState = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${pending.id}/consume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        mode: 'total',
        wallet_id: foreignWallet.id,
        category_id: category.id,
        amount: '30000',
        transacted_at: '2026-05-29T01:00:00.000Z',
      },
    });
    expect(wrongState.statusCode).toBe(409);
    expect(wrongState.json().error.code).toBe('receipt.invalid_state');

    const foreign = await app.inject({
      method: 'POST',
      url: `/receipts/scans/${ready.id}/consume`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        mode: 'total',
        wallet_id: foreignWallet.id,
        category_id: category.id,
        amount: '30000',
        transacted_at: '2026-05-29T01:00:00.000Z',
      },
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe('wallet.not_found');
  });

  it('DELETE /receipts/scans/:id soft-deletes scan', async () => {
    const { token, user } = await userWithToken();
    const scan = await prisma.receiptScan.create({
      data: {
        user_id: user.id,
        source: 'in_app',
        r2_key: 'delete-me',
        content_type: 'image/jpeg',
        size_bytes: 100,
      },
    });

    const del = await app.inject({
      method: 'DELETE',
      url: `/receipts/scans/${scan.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().ok).toBe(true);

    const get = await app.inject({
      method: 'GET',
      url: `/receipts/scans/${scan.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(404);
  });
});
