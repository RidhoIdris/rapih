import { useEffect } from 'react';
import { type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';

type Props = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Pulsing placeholder block. Animates opacity between two values so it reads
 * as "loading" without depending on a gradient/mask lib. Use to fake a load
 * state on first mount while real data wires up later.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [o]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: palette.sand },
        animatedStyle,
        style,
      ]}
    />
  );
}
