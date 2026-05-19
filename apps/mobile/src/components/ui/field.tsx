import type { ReactNode } from 'react';
import { Pressable, TextInput, View, type TextStyle } from 'react-native';

import { palette, radius as radii, space, textVariants, type TextVariant } from '@/theme';

import { Card } from './card';
import { Text } from './text';

type Props = {
  /** Uppercase label, e.g. "EMAIL" */
  label: string;
  /** Filled value. Omit to show `placeholder`. */
  value?: string;
  placeholder?: string;
  /** Mint focus halo + ring */
  focused?: boolean;
  /** Show a blinking caret after the value (active field) */
  caret?: boolean;
  /** Trailing accessory, e.g. a "Lihat" toggle */
  trailing?: ReactNode;
  /** Type scale for the value. Default `value`; nickname uses `displayInput`. */
  valueVariant?: TextVariant;
  /** letterSpacing override for the value (password dots use 4) */
  valueLetterSpacing?: number;
  /** Escape hatch for one-off value styling (e.g. larger password dots) */
  valueStyle?: TextStyle;
  radius?: number;
  onPress?: () => void;
};

/**
 * A "card input" — the design's signature field: a white card holding an
 * uppercase label over its value. This is a faithful visual stand-in
 * (UI-only build). To make it editable later, swap the value <Text> for a
 * <TextInput> here — no screen will need to change.
 */
export function Field({
  label,
  value,
  placeholder,
  focused = false,
  trailing,
  valueVariant = 'value',
  valueLetterSpacing,
  valueStyle,
  radius = radii.lg,
  onPress,
}: Props) {
  return (
    <Pressable onPress={onPress}>
      <Card
        focused={focused}
        radius={radius}
        style={{
          paddingHorizontal: space.lg,
          paddingVertical: space.md + 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={palette.inkMute}>
            {label}
          </Text>
          <TextInput
            defaultValue={value}
            placeholder={placeholder}
            placeholderTextColor={palette.inkMute}
            style={[
              textVariants[valueVariant],
              { color: palette.ink, marginTop: space.xs, padding: 0 },
              valueLetterSpacing != null && { letterSpacing: valueLetterSpacing },
              valueStyle,
            ]}
          />
        </View>
        {trailing ? <View style={{ marginLeft: space.md }}>{trailing}</View> : null}
      </Card>
    </Pressable>
  );
}
