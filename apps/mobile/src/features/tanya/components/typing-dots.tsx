import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme';
import { AiAvatar } from './message-bubble';

function Dot({ delay }: { delay: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320 }),
          withTiming(0, { duration: 320 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.65,
    transform: [{ translateY: -t.value * 3 }],
  }));

  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 6, backgroundColor: palette.inkMute },
        style,
      ]}
    />
  );
}

/** "Rapih is typing" — AI avatar + three pulsing dots in a card bubble. */
export function TypingDots() {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(170).mass(0.5)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        alignSelf: 'flex-start',
        marginVertical: 4,
      }}>
      <AiAvatar />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: palette.card,
          borderRadius: 20,
          borderTopLeftRadius: 7,
          borderCurve: 'continuous',
          paddingVertical: 14,
          paddingHorizontal: 16,
          boxShadow: `0 2px 10px rgba(10,10,14,0.04), 0 0 0 1px ${palette.inkFaint}`,
        }}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </Animated.View>
  );
}
