import { View } from 'react-native';

import { fontFamily } from '@/theme';
import { Text } from '@/components/ui/text';

/** Avatar disc with monogram initials. */
export function Monogram({
  initials = 'RP',
  size = 36,
  bg = '#2d3b2c',
  fg = '#d2f24a',
}: {
  initials?: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        color={fg}
        style={{
          fontFamily: fontFamily.sans600,
          fontSize: size * 0.36,
          letterSpacing: 0.3,
        }}>
        {initials}
      </Text>
    </View>
  );
}
