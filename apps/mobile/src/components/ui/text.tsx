import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { palette, textVariants, type TextVariant } from '@/theme';

type Props = RNTextProps & {
  /** Named style from the design type scale. Defaults to `body`. */
  variant?: TextVariant;
  /** Any palette value or raw color. Defaults to ink. */
  color?: string;
};

/**
 * The only text component in the app. Always pick a `variant` so the type
 * scale stays consistent — never set fontSize/fontFamily ad-hoc in screens.
 *
 *   <Text variant="displayM">Halo!</Text>
 *   <Text variant="body" color={palette.inkSoft}>...</Text>
 */
export function Text({ variant = 'body', color = palette.ink, style, ...rest }: Props) {
  return <RNText {...rest} style={[textVariants[variant], { color }, style]} />;
}
