import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '../config/env.js';

/**
 * Uploads a receipt image to Cloudflare R2 and returns the public URL.
 * Returns null if R2 credentials are not configured (dev / test environments).
 */
export async function uploadReceiptImage(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  const env = loadEnv();
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET_NAME ||
    !env.R2_PUBLIC_URL
  ) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const ext = extname(filename) || '.jpg';
  const key = `receipts/${randomUUID()}${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return `${env.R2_PUBLIC_URL}/${key}`;
}
