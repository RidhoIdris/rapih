/**
 * Rapih design tokens — the single source of truth for color, space, radius
 * and elevation. Ported verbatim from the approved design system
 * (white base + pastel mint). Do NOT hardcode colors in screens; always
 * pull from here so a redesign is a one-file change.
 */

export const palette = {
  /** near-white app background with a faint mint hint */
  bg: '#fafbf7',
  /** deeper background wash, used behind floating bars */
  bgDeep: '#eef0e8',
  /** deep forest charcoal — primary text */
  ink: '#1c2418',
  /** secondary text */
  inkSoft: 'rgba(28,36,24,0.62)',
  /** muted text / captions */
  inkMute: 'rgba(28,36,24,0.42)',
  /** hairline borders & 1px rings */
  inkFaint: 'rgba(28,36,24,0.12)',
  /** raised surface (cards, inputs) */
  card: '#ffffff',
  /** pale mint chip */
  sand: '#e8ede2',
  /** deeper sand — inactive step dots */
  sandDeep: '#cdd6c4',
  /** pastel mint green — the pop accent */
  lime: '#b8e8c2',
  /** soft mint — glow / focus ring halo */
  limeSoft: '#dff2e3',
  /** deep forest — "wealth" surface, dark screens */
  moss: '#2d4733',
  /** medium forest */
  mossSoft: '#456655',
  /** peach coral — alerts / destructive */
  coral: '#f3a899',
  /** medium sage — positive figures / charts */
  cool: '#5a8a6a',
  /** text/icons on top of moss or lime surfaces */
  onDark: '#f0f0e8',
} as const;

export type ColorToken = keyof typeof palette;

/** 4pt spacing scale. Use `space.x` everywhere instead of magic numbers. */
export const space = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const;

/** Corner radii. `pill` is intentionally huge to fully round capsules. */
export const radius = {
  sm: 6,
  md: 14,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Category / accent tints — soft pastel tile backgrounds with a matching
 * readable ink. Used for quick-access tiles, category bars, info cards.
 * These are CONTENT accents, distinct from the core brand palette.
 */
export const tint = {
  amber: '#fef0bb',
  amberInk: '#5a4a20',
  mint: '#dff2e3',
  mintInk: '#2d4733',
  iris: '#e7e6f6',
  irisInk: '#4a3d8e',
  peach: '#fde0d4',
  peachInk: '#8a4438',
} as const;

/**
 * Elevation as CSS `boxShadow` strings (required by the Expo styling rules —
 * never use legacy RN shadow/elevation props).
 */
export const shadow = {
  /** 1px hairline ring used on cards & inputs */
  ring: `0 0 0 1px ${palette.inkFaint}`,
  /** focused input: mint ring + soft halo */
  ringFocus: `0 0 0 1.5px ${palette.lime}, 0 4px 18px ${palette.limeSoft}`,
  /** floating action / primary button lift */
  lift: '0 8px 22px rgba(31,42,31,0.32)',
  /** large soft card drop */
  card: '0 12px 40px rgba(10,10,14,0.10)',
} as const;
