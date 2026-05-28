import { Button, Screen, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth-store';
import { palette } from '@/theme';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Alert, View } from 'react-native';
import { ScanPaywallCard } from '../components/scan-paywall-card';
import { useReceiptStore } from '../receipt-store';

async function assetSize(asset: ImagePicker.ImagePickerAsset): Promise<number> {
  return asset.fileSize ?? 1;
}

export function ScanReceiptScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const startScan = useReceiptStore((state) => state.startScan);

  async function handleAsset(asset: ImagePicker.ImagePickerAsset) {
    const id = await startScan(
      asset.uri,
      'in_app',
      asset.mimeType ?? 'image/jpeg',
      await assetSize(asset)
    );
    router.push('/(app)/receipts' as Href);
    Alert.alert('Struk dikirim', `ID ${id} sedang diproses.`);
  }

  async function handleCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izinkan akses kamera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) await handleAsset(result.assets[0]);
  }

  async function handleGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0]) await handleAsset(result.assets[0]);
  }

  return (
    <Screen background={palette.bg} bottomInset={28}>
      <View style={{ padding: 22, gap: 18 }}>
        <Text variant="figureS" style={{ fontSize: 28 }}>
          Scan struk
        </Text>
        {user?.tier === 'free' ? (
          <ScanPaywallCard />
        ) : (
          <View style={{ gap: 12 }}>
            <Text variant="bodySm" color={palette.inkSoft}>
              Foto atau pilih gambar struk. Rapih akan kirim notifikasi saat OCR selesai.
            </Text>
            <Button label="Kamera" onPress={handleCamera} fullWidth />
            <Button label="Galeri" onPress={handleGallery} variant="social" fullWidth />
          </View>
        )}
      </View>
    </Screen>
  );
}
