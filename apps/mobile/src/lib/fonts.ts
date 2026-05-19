import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_500Medium_Italic,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';

import { fontFamily } from '@/theme/typography';

/**
 * Maps our canonical family keys (see `theme/typography.ts`) to the actual
 * Google font modules. The KEY is what `fontFamily` in styles must equal.
 * Add a new weight here + in `typography.ts` if a design ever needs it.
 */
const FONT_MAP = {
  [fontFamily.display400]: BricolageGrotesque_400Regular,
  [fontFamily.display500]: BricolageGrotesque_500Medium,
  [fontFamily.display600]: BricolageGrotesque_600SemiBold,
  [fontFamily.display700]: BricolageGrotesque_700Bold,
  [fontFamily.sans400]: PlusJakartaSans_400Regular,
  [fontFamily.sans500]: PlusJakartaSans_500Medium,
  [fontFamily.sans600]: PlusJakartaSans_600SemiBold,
  [fontFamily.sans700]: PlusJakartaSans_700Bold,
  [fontFamily.sans800]: PlusJakartaSans_800ExtraBold,
  [fontFamily.sansItalic500]: PlusJakartaSans_500Medium_Italic,
  [fontFamily.mono400]: JetBrainsMono_400Regular,
  [fontFamily.mono500]: JetBrainsMono_500Medium,
};

/**
 * Loads every app font. Returns `[loaded, error]`. The root layout keeps the
 * native splash up until this resolves so text never flashes in a fallback.
 */
export function useAppFonts() {
  return useFonts(FONT_MAP);
}
