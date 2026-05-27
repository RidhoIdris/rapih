import { exportJWK, generateKeyPair, type JWK, type KeyLike, SignJWT } from 'jose';

export interface MockKey {
  kid: string;
  privateKey: KeyLike;
  jwk: JWK;
}

export interface MockJwksServer {
  url: string;
  keys: MockKey[];
  close: () => Promise<void>;
}

export async function createMockJwks(opts: { kid?: string } = {}): Promise<MockJwksServer> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const kid = opts.kid ?? 'test-kid';
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  const { default: Fastify } = await import('fastify');
  const app = Fastify({ logger: false });
  app.get('/jwks', async () => ({ keys: [publicJwk] }));

  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('mock jwks server failed to bind');
  }

  return {
    url: `http://127.0.0.1:${address.port}/jwks`,
    keys: [{ kid, privateKey, jwk: publicJwk }],
    async close() {
      await app.close();
    },
  };
}

export async function signMockIdToken(
  key: MockKey,
  payload: Record<string, unknown>,
  opts: { iss: string; aud: string; expSeconds?: number }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'RS256', kid: key.kid })
    .setIssuer(opts.iss)
    .setAudience(opts.aud)
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expSeconds ?? 3600))
    .sign(key.privateKey);
}
