import { Button, Text } from '@/components/ui';
import { palette } from '@/theme';
import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

export function ScanPaywallCard() {
  const router = useRouter();
  return (
    <View
      style={{
        margin: 22,
        padding: 18,
        borderRadius: 22,
        backgroundColor: palette.card,
        gap: 12,
      }}>
      <Text variant="figureS" style={{ fontSize: 20 }}>
        Scan struk hanya untuk Plus
      </Text>
      <Text variant="bodySm" color={palette.inkSoft}>
        Upload struk, tunggu OCR, lalu simpan transaksi tanpa ketik ulang.
      </Text>
      <Button label="Upgrade" onPress={() => router.push('/(app)/pengaturan' as Href)} />
    </View>
  );
}
