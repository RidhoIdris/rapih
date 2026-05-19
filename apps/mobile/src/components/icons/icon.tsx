import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme';

/**
 * Single-color line icons, ported 1:1 from the design's `RIcons` set
 * (same paths, same viewBoxes). Add new glyphs here only — never inline
 * raw <Svg> in screens.
 *
 *   <Icon name="arrowR" size={14} color={palette.onDark} />
 */
export type IconName =
  | 'bolt'
  | 'sparkle'
  | 'leaf'
  | 'arrowUp'
  | 'arrowDn'
  | 'arrowR'
  | 'chevronLeft'
  | 'plus'
  | 'search'
  | 'mic'
  | 'bell'
  | 'more'
  | 'check'
  | 'x'
  | 'swap'
  | 'send'
  | 'filter'
  | 'doc'
  | 'image';

type Props = {
  name: IconName;
  /** Rendered square size in px. Defaults to each glyph's natural size. */
  size?: number;
  color?: string;
};

/** viewBox per glyph (matches the design exactly) + natural pixel size. */
const META: Record<IconName, { vb: string; size: number }> = {
  bolt: { vb: '0 0 14 14', size: 14 },
  sparkle: { vb: '0 0 14 14', size: 14 },
  leaf: { vb: '0 0 14 14', size: 14 },
  arrowUp: { vb: '0 0 12 12', size: 12 },
  arrowDn: { vb: '0 0 12 12', size: 12 },
  arrowR: { vb: '0 0 12 12', size: 12 },
  chevronLeft: { vb: '0 0 14 14', size: 14 },
  plus: { vb: '0 0 14 14', size: 14 },
  search: { vb: '0 0 16 16', size: 16 },
  mic: { vb: '0 0 14 14', size: 14 },
  bell: { vb: '0 0 16 16', size: 16 },
  more: { vb: '0 0 16 4', size: 16 },
  check: { vb: '0 0 14 14', size: 14 },
  x: { vb: '0 0 12 12', size: 12 },
  swap: { vb: '0 0 14 14', size: 14 },
  send: { vb: '0 0 16 16', size: 16 },
  filter: { vb: '0 0 14 14', size: 14 },
  doc: { vb: '0 0 14 14', size: 14 },
  image: { vb: '0 0 14 14', size: 14 },
};

export function Icon({ name, size, color = palette.ink }: Props) {
  const { vb, size: natural } = META[name];
  const s = size ?? natural;
  const common = { width: s, height: s, viewBox: vb } as const;

  switch (name) {
    case 'bolt':
      return (
        <Svg {...common} fill="none">
          <Path d="M7.5 1L2 8h4l-1 5 5.5-7h-4l1-5z" fill={color} />
        </Svg>
      );
    case 'sparkle':
      return (
        <Svg {...common} fill="none">
          <Path d="M7 1l1.4 4.6L13 7l-4.6 1.4L7 13l-1.4-4.6L1 7l4.6-1.4L7 1z" fill={color} />
        </Svg>
      );
    case 'leaf':
      return (
        <Svg {...common} fill="none">
          <Path d="M12 2C6 2 2 6 2 12c5 0 10-3 10-10z" fill={color} />
          <Path d="M2 12L7 7" stroke="#fff" strokeWidth={1.2} strokeOpacity={0.3} />
        </Svg>
      );
    case 'arrowUp':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M6 10V2M2 6l4-4 4 4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'arrowDn':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M6 2v8M2 6l4 4 4-4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'arrowR':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M2 6h8M6 2l4 4-4 4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'chevronLeft':
      return (
        <Svg {...common} fill="none">
          <Path d="M9 2L4 7l5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...common} fill="none">
          <Path d="M7 2v10M2 7h10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case 'search':
      return (
        <Svg {...common} fill="none">
          <Circle cx={7} cy={7} r={5} stroke={color} strokeWidth={1.5} />
          <Path d="M11 11l3 3" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'mic':
      return (
        <Svg {...common} fill="none">
          <Rect x={5} y={1.5} width={4} height={7} rx={2} fill={color} />
          <Path
            d="M3 7a4 4 0 008 0M7 11v1.5M5 12.5h4"
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M3.5 11h9l-1.5-2V6.5a3.5 3.5 0 00-7 0V9L3.5 11z"
            stroke={color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path d="M6.5 13a1.5 1.5 0 003 0" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      );
    case 'more':
      return (
        <Svg {...common} fill="none">
          <Circle cx={2} cy={2} r={1.5} fill={color} />
          <Circle cx={8} cy={2} r={1.5} fill={color} />
          <Circle cx={14} cy={2} r={1.5} fill={color} />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M2.5 7.5l3 3 6-6"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'x':
      return (
        <Svg {...common} fill="none">
          <Path d="M3 3l6 6M9 3l-6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 'swap':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M2 4h8M8 1l3 3-3 3M12 10H4M6 13l-3-3 3-3"
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'send':
      return (
        <Svg {...common} fill="none">
          <Path d="M2 8l12-6-3 14-3-6L2 8z" fill={color} />
        </Svg>
      );
    case 'filter':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M1 3h12M3 7h8M5 11h4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'doc':
      return (
        <Svg {...common} fill="none">
          <Path
            d="M2 2h7l3 3v7H2V2zM9 2v3h3"
            stroke={color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'image':
      return (
        <Svg {...common} fill="none">
          <Rect x={2} y={2} width={10} height={10} rx={1} stroke={color} strokeWidth={1.4} />
          <Path d="M2 9l3-3 3 3 4-4" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
        </Svg>
      );
  }
}
