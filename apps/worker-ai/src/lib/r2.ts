import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '../config/env.js';

type DownloadResult = { b64: string; contentType: string };
type DownloadFn = (key: string) => Promise<DownloadResult>;

let client: S3Client | undefined;
let injectedDownload: DownloadFn | undefined;

function getClient(): S3Client {
  if (!client) {
    const env = loadEnv();
    client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function downloadAsBase64(key: string): Promise<DownloadResult> {
  if (injectedDownload) return injectedDownload(key);
  const env = loadEnv();
  const res = await getClient().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
  const bytes = await body.transformToByteArray();
  return {
    b64: Buffer.from(bytes).toString('base64'),
    contentType: res.ContentType ?? 'application/octet-stream',
  };
}

export function __setR2DownloadForTests(fn: DownloadFn | undefined): void {
  injectedDownload = fn;
}
