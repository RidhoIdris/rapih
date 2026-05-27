import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

const cache = new Map<string, JWTVerifyGetKey>();

function getOrCreate(url: string): JWTVerifyGetKey {
  const existing = cache.get(url);
  if (existing) return existing;
  const set = createRemoteJWKSet(new URL(url), {
    cacheMaxAge: 10 * 60 * 1000, // 10 min
    cooldownDuration: 30 * 1000, // 30s
  });
  cache.set(url, set);
  return set;
}

export function googleJwks(overrideUrl?: string): JWTVerifyGetKey {
  return getOrCreate(overrideUrl ?? GOOGLE_JWKS_URL);
}

export function appleJwks(overrideUrl?: string): JWTVerifyGetKey {
  return getOrCreate(overrideUrl ?? APPLE_JWKS_URL);
}
