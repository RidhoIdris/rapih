import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';

/** Blinking text caret — mirrors the design's `@keyframes blink`. */
export function Caret({ height = 16, color = palette.ink }: { height?: number; color?: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: 2, height, backgroundColor: color, marginLeft: 2, borderRadius: 1 },
        animatedStyle,
      ]}
    />
  );
}
