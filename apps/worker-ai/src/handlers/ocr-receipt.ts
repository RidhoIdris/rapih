import type { Prisma } from '@rapih/db';
import { ReceiptOcrResult } from '@rapih/shared';
import type { Job } from 'bullmq';
import { loadEnv } from '../config/env.js';
import { computeCost } from '../lib/cost.js';
import { logger } from '../lib/logger.js';
import { getOpenAi } from '../lib/openai.js';
import { getPrisma } from '../lib/prisma.js';
import { downloadAsBase64 } from '../lib/r2.js';
import { getReminderQueue } from '../queues/reminder.js';
import { OCR_SYSTEM_PROMPT } from './ocr-system-prompt.js';

export type OcrReceiptPayload = { user_id: string; scan_id: string };

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function markFailed(scanId: string, reason: string): Promise<void> {
  await getPrisma().receiptScan.update({
    where: { id: scanId },
    data: { status: 'failed', failed_reason: reason },
  });
}

async function enqueueReadyPush(userId: string, scanId: string): Promise<void> {
  await getReminderQueue().add(
    'receipts.ready-push',
    { user_id: userId, scan_id: scanId },
    { jobId: `ready-${scanId}` }
  );
}

async function enqueueFailedPush(userId: string, scanId: string, reason: string): Promise<void> {
  await getReminderQueue().add(
    'receipts.failed-push',
    { user_id: userId, scan_id: scanId, reason },
    { jobId: `failed-${scanId}` }
  );
}

export async function handleOcrReceipt(job: Job<OcrReceiptPayload>): Promise<void> {
  const { user_id, scan_id } = job.data;
  const prisma = getPrisma();
  const env = loadEnv();

  const scan = await prisma.receiptScan.findFirst({
    where: { id: scan_id, user_id, deleted_at: null },
  });
  if (!scan) {
    throw new Error('scan_not_found');
  }
  if (scan.status !== 'processing') {
    return;
  }

  try {
    const { b64, contentType } = await downloadAsBase64(scan.r2_key);
    const completion = await getOpenAi().chat.completions.create({
      model: env.OPENAI_OCR_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Ekstrak data struk berikut.' },
            {
              type: 'image_url',
              image_url: { url: `data:${contentType};base64,${b64}`, detail: 'high' },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = ReceiptOcrResult.safeParse(safeJsonParse(raw));
    if (!parsed.success) {
      logger.warn({ scan_id, raw, error: parsed.error.flatten() }, 'ocr-receipt parse failed');
      await markFailed(scan.id, 'parse_failed');
      await enqueueFailedPush(user_id, scan.id, 'parse_failed');
      return;
    }

    await prisma.receiptScan.update({
      where: { id: scan.id },
      data: {
        status: 'ready',
        ocr_result: parsed.data as Prisma.InputJsonValue,
      },
    });

    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    await prisma.aiUsageLog.create({
      data: {
        user_id,
        session_id: null,
        kind: 'ocr',
        model: env.OPENAI_OCR_MODEL,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: usage?.total_tokens ?? promptTokens + completionTokens,
        cost_usd: computeCost(env.OPENAI_OCR_MODEL, promptTokens, completionTokens),
      },
    });

    await enqueueReadyPush(user_id, scan.id);
  } catch (err) {
    logger.error({ err, scan_id }, 'ocr-receipt failed');
    await markFailed(scan.id, 'internal');
    await enqueueFailedPush(user_id, scan.id, 'internal');
    throw err;
  }
}
