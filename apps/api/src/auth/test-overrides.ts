/**
 * Test hooks. ONLY used when NODE_ENV === 'test' so production code paths
 * never depend on these. Lets integration tests redirect Google + Apple
 * verification to a mock JWKS endpoint without monkey-patching modules.
 */
let googleOverride: string | undefined;
let appleOverride: string | undefined;

export function setTestJwksOverrides(opts: { google?: string; apple?: string }): void {
  if (process.env.NODE_ENV !== 'test') return;
  googleOverride = opts.google;
  appleOverride = opts.apple;
}

export function clearTestJwksOverrides(): void {
  googleOverride = undefined;
  appleOverride = undefined;
}

export function getJwksOverride(provider: 'google' | 'apple'): string | undefined {
  if (process.env.NODE_ENV !== 'test') return undefined;
  return provider === 'google' ? googleOverride : appleOverride;
}
