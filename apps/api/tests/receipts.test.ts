import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/tokens.js';
import { getTestPrisma, resetTestDb } from './helpers/test-db.js';
import './helpers/test-env.js';

const prisma = getTestPrisma();

async function userWithToken(opts: { onboarded?: boolean } = { onboarded: true }) {
  const user = await prisma.user.create({
    data: {
      email: `receipt-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: opts.onboarded ? new Date() : null,
      profile: { create: {} },
    },
  });
  const token = signAccessToken({
    userId: user.id,
    tier: 'free',
    secret: process.env.JWT_ACCESS_SECRET as string,
    ttlSeconds: 900,
  });
  return { user, token };
}

/** Build a raw multipart body with text fields only (no image). */
function multipartBody(fields: Record<string, string>): { body: Buffer; contentType: string } {
  const boundary = 'testboundary123';
  const parts = Object.entries(fields)
    .map(([name, value]) =>
      [`--${boundary}`, `Content-Disposition: form-data; name="${name}"`, '', value].join('\r\n')
    )
    .join('\r\n');
  const body = Buffer.from(`${parts}\r\n--${boundary}--\r\n`);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('receipts CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await app.close();
  });

  // ─── Auth / onboarding guards ────────────────────────────────────────

  it('GET /receipts returns 401 without bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/receipts' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /receipts returns 403 if onboarding not complete', async () => {
    const { token } = await userWithToken({ onboarded: false });
    const res = await app.inject({
      method: 'GET',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('onboarding.required');
  });

  // ─── List ────────────────────────────────────────────────────────────

  it('GET /receipts returns empty list for new user', async () => {
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.receipts).toEqual([]);
  });

  // ─── Create (multipart) ──────────────────────────────────────────────

  it('POST /receipts creates a receipt without image', async () => {
    const { token } = await userWithToken();
    const { body, contentType } = multipartBody({
      merchant_name: 'Indomaret',
      total_amount: '75000',
      scanned_at: '2026-06-01T10:00:00.000Z',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const { receipt } = res.json().data;
    expect(receipt.merchant_name).toBe('Indomaret');
    expect(receipt.total_amount).toBe('75000');
    expect(receipt.image_url).toBeNull();
  });

  it('POST /receipts creates with only scanned_at (all optional fields absent)', async () => {
    const { token } = await userWithToken();
    const { body, contentType } = multipartBody({
      scanned_at: '2026-06-02T08:30:00.000Z',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const { receipt } = res.json().data;
    expect(receipt.merchant_name).toBeNull();
    expect(receipt.total_amount).toBeNull();
    expect(receipt.image_url).toBeNull();
  });

  it('POST /receipts returns 400 if scanned_at missing', async () => {
    const { token } = await userWithToken();
    const { body, contentType } = multipartBody({ merchant_name: 'Alfamart' });
    const res = await app.inject({
      method: 'POST',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  it('POST /receipts returns 400 for invalid total_amount', async () => {
    const { token } = await userWithToken();
    const { body, contentType } = multipartBody({
      scanned_at: '2026-06-01T10:00:00.000Z',
      total_amount: 'abc',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Get single ──────────────────────────────────────────────────────

  it('GET /receipts/:id returns the receipt', async () => {
    const { token, user } = await userWithToken();
    const row = await prisma.receipt.create({
      data: {
        user_id: user.id,
        merchant_name: 'Alfamart',
        total_amount: 50000n,
        scanned_at: new Date('2026-06-01'),
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/receipts/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.receipt.id).toBe(row.id);
    expect(res.json().data.receipt.total_amount).toBe('50000');
  });

  it("GET /receipts/:id returns 404 for another user's receipt", async () => {
    const other = await prisma.user.create({
      data: { email: 'other-receipt@e.com', name: 'Other', onboarding_completed_at: new Date() },
    });
    const row = await prisma.receipt.create({
      data: { user_id: other.id, scanned_at: new Date() },
    });
    const { token } = await userWithToken();
    const res = await app.inject({
      method: 'GET',
      url: `/receipts/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('receipt.not_found');
  });

  // ─── receipt_id on Transaction ───────────────────────────────────────

  it('transaction with receipt_id links to receipt', async () => {
    const { token, user } = await userWithToken();
    const wallet = await prisma.wallet.create({
      data: { user_id: user.id, kind: 'cash', provider_name: 'Tunai', initial_balance: 0n },
    });
    const receipt = await prisma.receipt.create({
      data: { user_id: user.id, merchant_name: 'Indomaret', scanned_at: new Date() },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'expense',
        wallet_id: wallet.id,
        receipt_id: receipt.id,
        amount: '25000',
        transacted_at: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transaction.receipt_id).toBe(receipt.id);
  });

  // ─── Update ──────────────────────────────────────────────────────────

  it('PATCH /receipts/:id updates metadata', async () => {
    const { token, user } = await userWithToken();
    const row = await prisma.receipt.create({
      data: { user_id: user.id, merchant_name: 'Old', scanned_at: new Date('2026-06-01') },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/receipts/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { merchant_name: 'New Name', total_amount: '120000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.receipt.merchant_name).toBe('New Name');
    expect(res.json().data.receipt.total_amount).toBe('120000');
  });

  it('PATCH /receipts/:id rejects empty body', async () => {
    const { token, user } = await userWithToken();
    const row = await prisma.receipt.create({
      data: { user_id: user.id, scanned_at: new Date() },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/receipts/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation.failed');
  });

  // ─── Delete ──────────────────────────────────────────────────────────

  it('DELETE /receipts/:id soft-deletes, list omits it', async () => {
    const { token, user } = await userWithToken();
    const row = await prisma.receipt.create({
      data: { user_id: user.id, scanned_at: new Date() },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/receipts/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const dbRow = await prisma.receipt.findUnique({ where: { id: row.id } });
    expect(dbRow?.deleted_at).not.toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/receipts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json().data.receipts).toEqual([]);
  });

  it('DELETE /receipts/:id returns 404 if already deleted', async () => {
    const { token, user } = await userWithToken();
    const row = await prisma.receipt.create({
      data: { user_id: user.id, scanned_at: new Date(), deleted_at: new Date() },
    });
    const res = await app.inject({
      method: 'DELETE',
      url: `/receipts/${row.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
