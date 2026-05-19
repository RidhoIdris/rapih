import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, shadow } from '@/theme';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

/** 38px circular back affordance used in the auth header row. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        if (onPress) onPress();
        else if (router.canGoBack()) router.back();
      }}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 38,
        backgroundColor: palette.card,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: shadow.ring,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Icon name="chevronLeft" size={14} color={palette.ink} />
    </Pressable>
  );
}
