import { Text } from '@/components/ui';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';
import { View } from 'react-native';

export function AllocationSummary({
  allocated,
  total,
}: {
  allocated: number[];
  total: number;
}) {
  const sum = allocated.reduce((acc, value) => acc + value, 0);
  return (
    <View style={{ padding: 14, borderRadius: 18, backgroundColor: palette.card, gap: 4 }}>
      <Text variant="bodySm" style={{ fontWeight: '700' }}>
        Total alokasi
      </Text>
      <Text variant="bodySm" color={palette.inkSoft}>
        {rupiah(sum)} dari total OCR {rupiah(total)}
      </Text>
    </View>
  );
}
