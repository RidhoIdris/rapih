import type { Job } from 'bullmq';
import { type FetchFn, type PushMessage, sendPushes } from '../lib/expo-push.js';
import { claim } from '../lib/idempotency.js';
import { logger } from '../lib/logger.js';
import { writeNotification } from '../lib/notification-write.js';
import { getPrisma } from '../lib/prisma.js';

export type ReceiptsReadyPushPayload = { user_id: string; scan_id: string };

const TTL = 7 * 24 * 3600;

function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export async function handleReceiptsReadyPush(
  job: Job<ReceiptsReadyPushPayload>,
  fetchImpl: FetchFn = fetch
): Promise<{ pushed: number; skipped: number; removed: number }> {
  const prisma = getPrisma();
  const { user_id, scan_id } = job.data;
  const key = `push:receipt-ready:${scan_id}`;
  if (!(await claim(key, TTL))) {
    return { pushed: 0, skipped: 1, removed: 0 };
  }

  const scan = await prisma.receiptScan.findFirst({
    where: { id: scan_id, user_id, deleted_at: null },
  });
  if (!scan || scan.status !== 'ready') {
    logger.warn({ scan_id }, 'receipts-ready-push: scan missing or wrong state');
    return { pushed: 0, skipped: 1, removed: 0 };
  }

  const tokens = await prisma.deviceToken.findMany({ where: { user_id } });
  if (tokens.length === 0) {
    return { pushed: 0, skipped: 1, removed: 0 };
  }

  const result = scan.ocr_result as { merchant?: string | null; total?: number } | null;
  const merchant = result?.merchant ?? 'Struk';
  const total = result?.total ?? 0;
  const title = 'Struk siap direview';
  const body = `${merchant} · ${formatRupiah(total)}`;
  const notificationId = await writeNotification(prisma, {
    user_id,
    kind: 'receipt_ready',
    title,
    body,
    data: { kind: 'receipt_ready', scan_id },
  });

  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: { kind: 'receipt_ready', scan_id, notification_id: notificationId },
  }));
  const sendResult = await sendPushes(messages, fetchImpl);
  if (sendResult.removeTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: sendResult.removeTokens } } });
  }

  logger.info(
    { pushed: sendResult.ok.length, removed: sendResult.removeTokens.length },
    'receipts-ready-push complete'
  );
  return { pushed: sendResult.ok.length, skipped: 0, removed: sendResult.removeTokens.length };
}
