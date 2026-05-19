import Svg, { Rect } from 'react-native-svg';

import { palette } from '@/theme';

/**
 * The Rapih mark — three stacked lines, the bottom one tinted. Reads as a
 * small stack of papers being squared up ("rapih" = tidy).
 */
export function RapihMark({
  size = 22,
  color = palette.ink,
  accent = palette.lime,
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Rect x={3.5} y={5} width={15} height={2.6} rx={1.3} fill={color} />
      <Rect x={2} y={9.7} width={18} height={2.6} rx={1.3} fill={color} />
      <Rect x={3.5} y={14.4} width={15} height={2.6} rx={1.3} fill={accent} />
    </Svg>
  );
}
