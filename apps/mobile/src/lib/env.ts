/**
 * Mobile env vars. Pulled from EXPO_PUBLIC_* via process.env (Expo inlines them at build time).
 * Throws at module-load if any required var is missing — surfaces config errors early.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}. Check apps/mobile/.env`);
  }
  return value;
}

export const env = {
  apiUrl: required('EXPO_PUBLIC_API_URL'),
  googleWebClientId: required('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  googleIosClientId: required('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
} as const;
