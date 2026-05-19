import { Pressable, type ViewStyle } from 'react-native';

import { palette, radius } from '@/theme';
import { haptics } from '@/lib/haptics';

import { Text } from './text';

type Props = {
  label: string;
  bg?: string;
  color?: string;
  /** Adds the 1px ring (used for the card-style suggestion chips) */
  ringed?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Pill chip. Tap-able when `onPress` is set (fires selection haptic). */
export function Chip({
  label,
  bg = palette.sand,
  color = palette.ink,
  ringed = false,
  onPress,
  style,
}: Props) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          alignSelf: 'flex-start',
          paddingVertical: 7,
          paddingHorizontal: 11,
          borderRadius: radius.pill,
          backgroundColor: bg,
          boxShadow: ringed ? `0 0 0 1px ${palette.inkFaint}` : undefined,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}>
      <Text variant="chip" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}
