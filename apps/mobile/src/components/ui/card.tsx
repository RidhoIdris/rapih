import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { palette, radius as radii, shadow } from '@/theme';

type Props = {
  children: ReactNode;
  /** Mint focus halo instead of the default hairline ring */
  focused?: boolean;
  background?: string;
  radius?: number;
  style?: ViewStyle;
};

/** White raised surface with a 1px ring (or mint halo when `focused`). */
export function Card({
  children,
  focused = false,
  background = palette.card,
  radius = radii.lg,
  style,
}: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius,
          borderCurve: 'continuous',
          boxShadow: focused ? shadow.ringFocus : shadow.ring,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
