import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/theme';

type Props = {
  children: ReactNode;
  /** Screen background. Auth uses `bg` (light) or `moss` (dark hero). */
  background?: string;
  /**
   * Extra top padding ON TOP of the safe-area inset. The design pins content
   * ~38–50px below the status bar; pass that here (inset is added for you).
   */
  topInset?: number;
  /** Extra bottom padding on top of the safe-area inset. */
  bottomInset?: number;
  style?: ViewStyle;
};

/**
 * Full-bleed screen wrapper. Renders a ScrollView whose content fills the
 * viewport (so the design's `flex:1` spacer-to-bottom pattern works) but
 * still scrolls on short devices. Always accounts for both safe-area insets.
 */
export function Screen({
  children,
  background = palette.bg,
  topInset = 0,
  bottomInset = 0,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + topInset,
        paddingBottom: insets.bottom + bottomInset,
      }}
      bounces={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </ScrollView>
  );
}
