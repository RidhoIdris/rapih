import { View } from 'react-native';
import { Text } from '@/components/ui';
import { palette } from '@/theme';

const LABELS: Record<string, string> = {
  list_transactions: 'transaksi',
  summarize_month: 'ringkasan bulanan',
  get_budgets: 'budget',
  get_goals: 'goal',
  get_wallets: 'dompet',
};

export function ToolCallChip({ name }: { name: string }) {
  const label = LABELS[name] ?? name;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: palette.limeSoft,
        marginVertical: 4,
      }}>
      <Text color={palette.moss} style={{ fontSize: 12, fontWeight: '600' }}>
        ✦
      </Text>
      <Text variant="bodySm" color={palette.moss} style={{ fontSize: 11.5 }}>
        Mengambil {label}…
      </Text>
    </View>
  );
}
