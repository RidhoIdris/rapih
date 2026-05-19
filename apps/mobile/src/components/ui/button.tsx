import { Pressable, View, type ViewStyle } from 'react-native';

import { palette, radius, shadow } from '@/theme';
import { Icon, type IconName } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

import { Text } from './text';

type Variant = 'primary' | 'accent' | 'outlineDark' | 'social';

const VARIANT: Record<
  Variant,
  { bg: string; fg: string; height: number; radius: number; boxShadow?: string; border?: string }
> = {
  /** moss fill on light backgrounds */
  primary: { bg: palette.moss, fg: palette.onDark, height: 54, radius: radius.pill },
  /** lime fill on dark (moss) backgrounds */
  accent: { bg: palette.lime, fg: palette.moss, height: 56, radius: radius.pill },
  /** ghost outline on dark backgrounds */
  outlineDark: {
    bg: 'transparent',
    fg: palette.onDark,
    height: 52,
    radius: radius.pill,
    border: 'rgba(240,240,232,0.18)',
  },
  /** card chip used for social sign-in row */
  social: {
    bg: palette.card,
    fg: palette.ink,
    height: 48,
    radius: radius.lg,
    boxShadow: shadow.ring,
  },
};

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  /** Trailing icon (design uses `arrowR` on most CTAs) */
  icon?: IconName;
  /** Stretch to fill the parent row */
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  fullWidth,
  style,
}: Props) {
  const v = VARIANT[variant];
  const small = variant === 'social';
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: v.height,
          borderRadius: v.radius,
          backgroundColor: v.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 18,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          boxShadow: v.boxShadow,
          opacity: pressed ? 0.85 : 1,
          flex: fullWidth ? 1 : undefined,
          alignSelf: fullWidth ? 'stretch' : undefined,
        },
        style,
      ]}>
      <Text variant={small ? 'buttonSm' : 'button'} color={v.fg}>
        {label}
      </Text>
      {icon ? (
        <View style={{ marginTop: 1 }}>
          <Icon name={icon} size={14} color={v.fg} />
        </View>
      ) : null}
    </Pressable>
  );
}
