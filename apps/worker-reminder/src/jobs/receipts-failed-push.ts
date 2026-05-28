import type { Job } from 'bullmq';
import { type FetchFn, type PushMessage, sendPushes } from '../lib/expo-push.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { writeNotification } from '../lib/notification-write.js';
import { getPrisma } from '../lib/prisma.js';

export type ReceiptsFailedPushPayload = { reason: string; scan_id: string; user_id: string };

const TTL = 7 * 24 * 3600;

export async function handleReceiptsFailedPush(
  job: Job<ReceiptsFailedPushPayload>,
  fetchImpl: FetchFn = fetch
): Promise<{ pushed: number; skipped: number; removed: number }> {
  const prisma = getPrisma();
  const { reason, scan_id, user_id } = job.data;
  const key = `push:receipt-failed:${scan_id}`;
  if (!(await claim(key, TTL))) {
    return { pushed: 0, skipped: 1, removed: 0 };
  }

  const scan = await prisma.receiptScan.findFirst({
    where: { id: scan_id, user_id, deleted_at: null },
  });
  if (!scan || scan.status !== 'failed') {
    logger.warn({ scan_id }, 'receipts-failed-push: scan missing or wrong state');
    return { pushed: 0, skipped: 1, removed: 0 };
  }

  const tokens = await prisma.deviceToken.findMany({ where: { user_id } });
  if (tokens.length === 0) {
    return { pushed: 0, skipped: 1, removed: 0 };
  }

  const title = 'Struk gagal dibaca';
  const body = 'Coba foto ulang atau pilih dari galeri.';
  const notificationId = await writeNotification(prisma, {
    user_id,
    kind: 'receipt_failed',
    title,
    body,
    data: { kind: 'receipt_failed', scan_id, reason },
  });

  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: { kind: 'receipt_failed', scan_id, reason, notification_id: notificationId },
  }));
  const sendResult = await sendPushes(messages, fetchImpl);
  if (sendResult.removeTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: sendResult.removeTokens } } });
  }

  logger.info(
    { pushed: sendResult.ok.length, removed: sendResult.removeTokens.length },
    'receipts-failed-push complete'
  );
  return { pushed: sendResult.ok.length, skipped: 0, removed: sendResult.removeTokens.length };
}
