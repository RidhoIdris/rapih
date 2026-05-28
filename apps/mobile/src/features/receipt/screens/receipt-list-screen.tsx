import { BackButton, Button, Screen, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { ReceiptCard } from '../components/receipt-card';
import { useReceiptStore } from '../receipt-store';

export function ReceiptListScreen() {
  const router = useRouter();
  const { loadScans, scans, status } = useReceiptStore();

  useFocusEffect(
    useCallback(() => {
      void loadScans();
    }, [loadScans])
  );

  return (
    <Screen background={palette.bg} bottomInset={28}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 12 }}>
        <BackButton />
        <Text variant="figureS" style={{ fontSize: 24 }}>
          Struk
        </Text>
      </View>
      <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
        <Button label="Scan struk" onPress={() => router.push('/(app)/receipts/scan' as Href)} />
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={loadScans} />}
        contentContainerStyle={{ padding: 22, gap: 10 }}>
        {scans.length === 0 && status !== 'loading' ? (
          <Text variant="bodySm" color={palette.inkSoft}>
            Belum ada struk. Foto struk pertama biar Rapih bisa parse-in.
          </Text>
        ) : null}
        {scans.map((scan) => (
          <ReceiptCard
            key={scan.id}
            scan={scan}
            onPress={() => {
              haptics.tap();
              if (scan.status === 'processing' || scan.status === 'pending') {
                Alert.alert('Sebentar lagi siap.');
                return;
              }
              router.push(`/(app)/receipts/${scan.id}` as Href);
            }}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}
