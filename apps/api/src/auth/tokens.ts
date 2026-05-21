import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface SignAccessOpts {
  userId: string;
  tier: 'free' | 'plus' | 'pro';
  secret: string;
  ttlSeconds: number;
}

export interface AccessClaims {
  sub: string;
  tier: 'free' | 'plus' | 'pro';
  iat: number;
  exp: number;
}

export function signAccessToken(opts: SignAccessOpts): string {
  return jwt.sign({ tier: opts.tier }, opts.secret, {
    subject: opts.userId,
    expiresIn: opts.ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('invalid access token payload');
  }
  const { sub, tier, iat, exp } = decoded as Record<string, unknown>;
  if (
    typeof sub !== 'string' ||
    (tier !== 'free' && tier !== 'plus' && tier !== 'pro') ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    throw new Error('invalid access token claims');
  }
  return { sub, tier, iat, exp };
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashRefreshToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}
