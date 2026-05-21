const APPLE_RELAY_SUFFIX = '@privaterelay.appleid.com';

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isApplePrivateRelay(email: string): boolean {
  return normalizeEmail(email).endsWith(APPLE_RELAY_SUFFIX);
}
