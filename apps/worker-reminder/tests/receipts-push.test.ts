import './helpers/test-env.js';
import type { Job } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  handleReceiptsFailedPush,
  type ReceiptsFailedPushPayload,
} from '../src/jobs/receipts-failed-push.js';
import {
  handleReceiptsReadyPush,
  type ReceiptsReadyPushPayload,
} from '../src/jobs/receipts-ready-push.js';
import { closePrisma } from '../src/lib/prisma.js';
import { makeExpoMock } from './helpers/expo-mock.js';
import { closeTestDb, getTestPrisma, resetTestDb } from './helpers/test-db.js';
import { closeTestRedis, flushTestRedis } from './helpers/test-redis.js';

const prisma = getTestPrisma();

function readyJob(data: ReceiptsReadyPushPayload): Job<ReceiptsReadyPushPayload> {
  return { data } as unknown as Job<ReceiptsReadyPushPayload>;
}

function failedJob(data: ReceiptsFailedPushPayload): Job<ReceiptsFailedPushPayload> {
  return { data } as unknown as Job<ReceiptsFailedPushPayload>;
}

async function seedUser(devices = 1) {
  const user = await prisma.user.create({
    data: {
      email: `receipt-push-${Math.random().toString(36).slice(2)}@e.com`,
      name: 'Ridho',
      onboarding_completed_at: new Date(),
    },
  });
  for (let i = 0; i < devices; i++) {
    await prisma.deviceToken.create({
      data: {
        user_id: user.id,
        token: `ExponentPushToken[${user.id}-${i}]`,
        platform: 'ios',
      },
    });
  }
  return user;
}

async function seedScan(userId: string, status: 'ready' | 'failed') {
  return prisma.receiptScan.create({
    data: {
      user_id: userId,
      source: 'in_app',
      status,
      r2_key: `users/${userId}/receipts/scan.jpg`,
      content_type: 'image/jpeg',
      size_bytes: 100,
      failed_reason: status === 'failed' ? 'parse_failed' : null,
      ocr_result:
        status === 'ready'
          ? {
              merchant: 'Warung',
              transacted_at: '2026-05-29',
              subtotal: 25000,
              tax: null,
              service_charge: null,
              discount: null,
              total: 25000,
              currency: 'IDR',
              items: [],
              confidence: 'high',
            }
          : undefined,
    },
  });
}

describe('receipt push handlers', () => {
  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });

  afterAll(async () => {
    await closePrisma();
    await closeTestDb();
    await closeTestRedis();
  });

  it('ready push sends one message per device and writes one notification', async () => {
    const user = await seedUser(2);
    const scan = await seedScan(user.id, 'ready');
    const { fetchImpl, calls } = makeExpoMock();

    const res = await handleReceiptsReadyPush(
      readyJob({ user_id: user.id, scan_id: scan.id }),
      fetchImpl
    );

    expect(res.pushed).toBe(2);
    expect(calls[0]).toHaveLength(2);
    expect(calls[0]?.[0]).toMatchObject({
      title: 'Struk siap direview',
      body: 'Warung · Rp 25.000',
    });
    const notif = await prisma.notification.findFirstOrThrow();
    expect(notif.kind).toBe('receipt_ready');
    expect(notif.data).toMatchObject({ kind: 'receipt_ready', scan_id: scan.id });
  });

  it('failed push sends failure copy and writes failed notification', async () => {
    const user = await seedUser(1);
    const scan = await seedScan(user.id, 'failed');
    const { fetchImpl, calls } = makeExpoMock();

    const res = await handleReceiptsFailedPush(
      failedJob({ user_id: user.id, scan_id: scan.id, reason: 'parse_failed' }),
      fetchImpl
    );

    expect(res.pushed).toBe(1);
    expect(calls[0]?.[0]).toMatchObject({
      title: 'Struk gagal dibaca',
      body: 'Coba foto ulang atau pilih dari galeri.',
    });
    const notif = await prisma.notification.findFirstOrThrow();
    expect(notif.kind).toBe('receipt_failed');
    expect(notif.data).toMatchObject({
      kind: 'receipt_failed',
      scan_id: scan.id,
      reason: 'parse_failed',
    });
  });

  it('skips when there are no devices and does not write a notification', async () => {
    const user = await seedUser(0);
    const scan = await seedScan(user.id, 'ready');
    const { fetchImpl, calls } = makeExpoMock();

    const res = await handleReceiptsReadyPush(
      readyJob({ user_id: user.id, scan_id: scan.id }),
      fetchImpl
    );

    expect(res).toEqual({ pushed: 0, skipped: 1, removed: 0 });
    expect(calls).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('idempotent: second run with same scan is a no-op', async () => {
    const user = await seedUser(1);
    const scan = await seedScan(user.id, 'ready');
    const { fetchImpl } = makeExpoMock();
    await handleReceiptsReadyPush(readyJob({ user_id: user.id, scan_id: scan.id }), fetchImpl);

    const { fetchImpl: second, calls } = makeExpoMock();
    const res = await handleReceiptsReadyPush(
      readyJob({ user_id: user.id, scan_id: scan.id }),
      second
    );

    expect(calls).toHaveLength(0);
    expect(res.skipped).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('deletes unregistered device tokens', async () => {
    const user = await seedUser(1);
    const scan = await seedScan(user.id, 'failed');
    const { fetchImpl } = makeExpoMock(() => ({
      status: 'error',
      details: { error: 'DeviceNotRegistered' },
    }));

    const res = await handleReceiptsFailedPush(
      failedJob({ user_id: user.id, scan_id: scan.id, reason: 'internal' }),
      fetchImpl
    );

    expect(res.removed).toBe(1);
    expect(await prisma.deviceToken.count()).toBe(0);
  });
});
