import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { palette, tint } from '@/theme';

export function TanyaPaywallCard() {
  const router = useRouter();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
      }}>
      <View
        style={{
          backgroundColor: palette.card,
          borderRadius: 24,
          borderCurve: 'continuous',
          padding: 22,
          alignItems: 'center',
          maxWidth: 360,
        }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 56,
            backgroundColor: tint.amber,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
          <Icon name="sparkle" size={22} color={tint.goldInk} />
        </View>
        <Text variant="figureS" style={{ fontSize: 20, textAlign: 'center', letterSpacing: -0.5 }}>
          Tanya hanya untuk Plus
        </Text>
        <Text
          variant="body"
          color={palette.inkSoft}
          style={{ fontSize: 13.5, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          Upgrade ke Rapih Plus untuk ngobrol langsung dengan asisten keuangan
          yang tahu data kamu.
        </Text>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push('/(app)/pengaturan');
          }}
          style={{
            marginTop: 16,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: palette.moss,
          }}>
          <Text variant="chip" color={palette.lime} style={{ fontSize: 13 }}>
            Upgrade ke Plus
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
