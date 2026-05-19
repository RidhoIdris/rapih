import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { palette } from '@/theme';

/**
 * Soft radial light bloom used behind the dark (moss) hero screens.
 * Implemented with an SVG radial gradient so the falloff is exact and
 * works on every platform (no experimental CSS gradient dependency).
 */
export function Glow({
  size,
  color = palette.lime,
  opacity = 0.4,
  /** 0–1 — where the gradient fully fades to transparent */
  fadeAt = 0.65,
  position,
}: {
  size: number;
  color?: string;
  opacity?: number;
  fadeAt?: number;
  position: ViewStyle;
}) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, position]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset={String(fadeAt)} stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glow)" />
      </Svg>
    </View>
  );
}
