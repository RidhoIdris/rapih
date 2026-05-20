import { Stack } from 'expo-router';

import { palette } from '@/theme';

const TAB_SWAP = { animation: 'none' as const };

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
        animation: 'slide_from_right',
        animationDuration: 220,
      }}>
      {/* top-level tab routes — cross-fade between them */}
      <Stack.Screen name="beranda" options={TAB_SWAP} />
      <Stack.Screen name="budget" options={TAB_SWAP} />
      <Stack.Screen name="transaksi" options={TAB_SWAP} />
      <Stack.Screen name="tanya" options={TAB_SWAP} />
      <Stack.Screen name="saya" options={TAB_SWAP} />
      <Stack.Screen
        name="tandai-bayar"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack>
  );
}
