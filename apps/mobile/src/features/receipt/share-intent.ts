import { useAuthStore } from '@/features/auth/auth-store';
import { useRouter, type Href } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useReceiptStore } from './receipt-store';

export function useReceiptShareIntent(): void {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const startScan = useReceiptStore((state) => state.startScan);
  const { hasShareIntent, resetShareIntent, shareIntent } = useShareIntent({
    resetOnBackground: true,
  });

  useEffect(() => {
    const file = shareIntent.files?.[0];
    if (!hasShareIntent || !file) return;
    if (!file.mimeType?.startsWith('image/')) {
      resetShareIntent();
      return;
    }
    if (!user) {
      Alert.alert('Login dulu untuk simpan struk.');
      resetShareIntent();
      return;
    }
    if (user.tier === 'free') {
      Alert.alert('Scan struk hanya untuk Rapih Plus.');
      resetShareIntent();
      return;
    }

    void (async () => {
      try {
        await startScan(file.path, 'share_intent', file.mimeType, file.size ?? 1);
        router.push('/(app)/receipts' as Href);
      } finally {
        resetShareIntent();
      }
    })();
  }, [hasShareIntent, resetShareIntent, router, shareIntent.files, startScan, user]);
}
