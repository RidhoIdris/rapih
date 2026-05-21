import { jwtVerify } from 'jose';
import { AppError } from '../lib/errors.js';
import { appleJwks, googleJwks } from './jwks.js';

export interface VerifyOpts {
  audiences: string[];
  jwksUrl?: string;
}

export interface SocialClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';

export async function verifyGoogleIdToken(token: string, opts: VerifyOpts): Promise<SocialClaims> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, googleJwks(opts.jwksUrl), {
      issuer: GOOGLE_ISSUERS,
      audience: opts.audiences,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401, {
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  const sub = payload.sub;
  const email = payload.email;
  const emailVerified = payload.email_verified;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401);
  }
  if (emailVerified !== true) {
    throw new AppError('auth.invalid_token', 'Email Google belum terverifikasi.', 401);
  }

  return {
    sub,
    email,
    email_verified: true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

export async function verifyAppleIdToken(token: string, opts: VerifyOpts): Promise<SocialClaims> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, appleJwks(opts.jwksUrl), {
      issuer: APPLE_ISSUER,
      audience: opts.audiences,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401, {
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== 'string' || typeof email !== 'string') {
    throw new AppError('auth.invalid_token', 'Token tidak valid.', 401);
  }

  return { sub, email };
}
