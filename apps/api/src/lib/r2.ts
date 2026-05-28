import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '../config/env.js';

let client: S3Client | undefined;

function endpoint(): string {
  const env = loadEnv();
  return env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

export function getR2Client(): S3Client {
  if (!client) {
    const env = loadEnv();
    client = new S3Client({
      region: 'auto',
      endpoint: endpoint(),
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function presignPut(
  key: string,
  contentType: string,
  sizeBytes: number
): Promise<{ url: string; headers: Record<string, string> }> {
  const env = loadEnv();
  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });
  const url = await getSignedUrl(getR2Client(), cmd, { expiresIn: 300 });
  return {
    url,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(sizeBytes),
    },
  };
}

export async function presignGet(key: string, ttlSeconds = 300): Promise<string> {
  const env = loadEnv();
  const cmd = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
  return getSignedUrl(getR2Client(), cmd, { expiresIn: ttlSeconds });
}

export async function headObject(
  key: string
): Promise<{ exists: boolean; size: number; contentType: string }> {
  const env = loadEnv();
  try {
    const res = await getR2Client().send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key })
    );
    return {
      exists: true,
      size: res.ContentLength ?? 0,
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      return { exists: false, size: 0, contentType: '' };
    }
    throw err;
  }
}
