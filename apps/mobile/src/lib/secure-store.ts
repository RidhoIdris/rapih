import * as SecureStore from 'expo-secure-store';

const KEYS = {
  refreshToken: 'rapih.refresh_token',
} as const;

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.refreshToken);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.refreshToken, token);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.refreshToken);
}
