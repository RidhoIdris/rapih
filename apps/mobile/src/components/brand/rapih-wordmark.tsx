import { View } from 'react-native';

import { fontFamily, palette } from '@/theme';
import { Text } from '@/components/ui/text';

import { RapihMark } from './rapih-mark';

/** Mark + "rapih" lockup. `size` drives the wordmark font size. */
export function RapihWordmark({
  size = 18,
  color = palette.ink,
  accent = palette.lime,
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <RapihMark size={size + 2} color={color} accent={accent} />
      <Text
        color={color}
        style={{ fontFamily: fontFamily.sans600, fontSize: size, letterSpacing: -0.4 }}>
        rapih
      </Text>
    </View>
  );
}
