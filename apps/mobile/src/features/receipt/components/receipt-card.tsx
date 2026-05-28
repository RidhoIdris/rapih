import { Text } from '@/components/ui';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';
import type { ReceiptScanDto } from '@rapih/shared';
import { Pressable, View } from 'react-native';

const STATUS_COPY: Record<ReceiptScanDto['status'], string> = {
  pending: 'Menunggu upload',
  processing: 'Memproses...',
  ready: 'Siap direview',
  consumed: 'Tersimpan',
  failed: 'Gagal',
};

export function ReceiptCard({
  onPress,
  scan,
}: {
  onPress: () => void;
  scan: ReceiptScanDto;
}) {
  const result = scan.ocr_result;
  const merchant = result?.merchant ?? 'Struk baru';
  const total = result?.total ?? null;
  const chipBg = scan.status === 'ready' ? tint.mint : scan.status === 'failed' ? tint.peach : palette.sand;
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: 20,
        backgroundColor: palette.card,
        gap: 8,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="bodySm" style={{ flex: 1, fontWeight: '700' }}>
          {merchant}
        </Text>
        <View style={{ borderRadius: 999, backgroundColor: chipBg, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Text variant="chip" style={{ fontSize: 10, fontWeight: '700' }}>
            {STATUS_COPY[scan.status]}
          </Text>
        </View>
      </View>
      <Text variant="bodySm" color={palette.inkSoft}>
        {total === null ? 'Total belum terbaca' : rupiah(total)} ·{' '}
        {new Date(scan.created_at).toLocaleDateString('id-ID')}
      </Text>
    </Pressable>
  );
}
