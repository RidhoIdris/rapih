import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/theme';

type Props = {
  children: ReactNode;
  /** Screen background. Auth uses `bg` (light) or `moss` (dark hero). */
  background?: string;
  /** Extra bottom padding on top of the safe-area inset. */
  bottomInset?: number;
  style?: ViewStyle;
};

/**
 * Full-bleed screen wrapper. Renders a ScrollView whose content fills the
 * viewport (so the design's `flex:1` spacer-to-bottom pattern works) but
 * still scrolls on short devices. Top spacing is the bare safe-area inset
 * (no extra gap); pass `bottomInset` only to clear a floating TabBar.
 */
export function Screen({
  children,
  background = palette.bg,
  bottomInset = 0,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  // Moss is the only dark surface — its status-bar content must be light;
  // every light screen needs dark content (clock/battery/wifi visible).
  const dark = background === palette.moss;
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + bottomInset,
        }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[{ flex: 1 }, style]}>{children}</View>
      </ScrollView>
      {/* opaque safe-area cap so scrolled content stays behind the clock */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: background,
        }}
      />
      <StatusBar style={dark ? 'light' : 'dark'} />
    </View>
  );
}
