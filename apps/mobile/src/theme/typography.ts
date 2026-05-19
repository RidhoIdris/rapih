import type { TextStyle } from 'react-native';

/**
 * Canonical font-family keys. Each weight is a SEPARATE registered family
 * because custom fonts on Android do not synthesize weight from
 * `fontWeight` — the family name is authoritative. These strings must match
 * the keys registered in `lib/fonts.ts`.
 *
 *  - `display`  → Bricolage Grotesque (editorial headings)
 *  - `sans`     → Plus Jakarta Sans (all UI text)
 *  - `mono`     → JetBrains Mono (figures / amounts)
 */
export const fontFamily = {
  display400: 'Bricolage-400',
  display500: 'Bricolage-500',
  display600: 'Bricolage-600',
  display700: 'Bricolage-700',
  sans400: 'Jakarta-400',
  sans500: 'Jakarta-500',
  sans600: 'Jakarta-600',
  sans700: 'Jakarta-700',
  sans800: 'Jakarta-800',
  sansItalic500: 'Jakarta-500-Italic',
  mono400: 'Mono-400',
  mono500: 'Mono-500',
} as const;

/**
 * Named text styles taken straight from the design. Screens reference these
 * via `<Text variant="...">` so type scale stays consistent. Color is NOT
 * baked in — it defaults to ink and is overridden with the `color` prop.
 */
export const textVariants = {
  /** Splash hero — the biggest type in the app */
  displayXL: {
    fontFamily: fontFamily.display500,
    fontSize: 56,
    letterSpacing: -2.8,
    lineHeight: 54,
  },
  /** Login / welcome hero */
  displayL: {
    fontFamily: fontFamily.display500,
    fontSize: 38,
    letterSpacing: -1.8,
    lineHeight: 39,
  },
  /** Signup step headings */
  displayM: {
    fontFamily: fontFamily.display500,
    fontSize: 36,
    letterSpacing: -1.6,
    lineHeight: 37,
  },
  /** Tighter heading (income step) */
  displayS: {
    fontFamily: fontFamily.display500,
    fontSize: 30,
    letterSpacing: -1.3,
    lineHeight: 31,
  },
  /** Large value typed into a "card input" (nickname) */
  displayInput: {
    fontFamily: fontFamily.display500,
    fontSize: 32,
    letterSpacing: -1.2,
  },
  /** Small uppercase colored label above a heading */
  eyebrow: {
    fontFamily: fontFamily.sans700,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  /** Body copy */
  body: {
    fontFamily: fontFamily.sans400,
    fontSize: 14,
    lineHeight: 21,
  },
  bodySm: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    lineHeight: 18,
  },
  /** Uppercase field label (inside Field) */
  label: {
    fontFamily: fontFamily.sans600,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  /** Field value text */
  value: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
  },
  /** Primary CTA label */
  button: {
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  /** Secondary / social button label */
  buttonSm: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
  },
  chip: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  /** Monospaced figures */
  mono: {
    fontFamily: fontFamily.mono500,
    fontSize: 12.5,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
