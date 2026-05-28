import { Text } from '@/components/ui';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';
import { TextInput, View } from 'react-native';

export type EditableReceiptItem = {
  amount: number;
  categoryId: string;
  name: string;
  qty: number;
  subtotal: number;
  unit_price: number;
};

export function LineItemRow({
  allocated,
  item,
  onNameChange,
}: {
  allocated: number;
  item: EditableReceiptItem;
  onNameChange: (name: string) => void;
}) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.inkFaint }}>
      <TextInput
        value={item.name}
        onChangeText={onNameChange}
        style={{ color: palette.ink, fontSize: 14, fontWeight: '700', padding: 0 }}
      />
      <Text variant="bodySm" color={palette.inkSoft} style={{ marginTop: 2 }}>
        OCR {rupiah(item.subtotal)} · disimpan {rupiah(allocated)}
      </Text>
    </View>
  );
}
