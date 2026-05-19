import { View } from 'react-native';

import { palette } from '@/theme';

import { Text } from './text';

/** Labeled rule: ──── atau lanjutkan dengan ────. */
export function LabeledDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.inkFaint }} />
      <Text variant="bodySm" color={palette.inkMute}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.inkFaint }} />
    </View>
  );
}
