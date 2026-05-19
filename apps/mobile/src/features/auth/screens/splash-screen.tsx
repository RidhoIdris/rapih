import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, space } from '@/theme';
import { RapihMark } from '@/components/brand';
import { Button, Glow, Screen, Text } from '@/components/ui';

export function SplashScreen() {
  const router = useRouter();

  return (
    <Screen background={palette.moss} topInset={24} bottomInset={8}>
      <Glow size={360} opacity={0.45} fadeAt={0.65} position={{ top: -80, right: -100 }} />
      <Glow size={380} opacity={0.18} fadeAt={0.7} position={{ bottom: -120, left: -120 }} />

      {/* logo */}
      <View
        style={{
          paddingTop: space.xxl,
          paddingHorizontal: space.xxl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <RapihMark size={26} color={palette.lime} accent={palette.onDark} />
        <Text
          color={palette.onDark}
          variant="button"
          style={{ fontSize: 18, letterSpacing: -0.4 }}>
          rapih
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* hero */}
      <View style={{ paddingHorizontal: space.xxl }}>
        <Text variant="eyebrow" color={palette.lime} style={{ letterSpacing: 1.8 }}>
          Sistem keuangan untuk yang baru mulai
        </Text>
        <Text variant="displayXL" color={palette.onDark} style={{ marginTop: 14 }}>
          Uangmu,{'\n'}
          <Text variant="displayXL" color={palette.lime} style={{ fontStyle: 'italic' }}>
            rapih
          </Text>{' '}
          &amp;{'\n'}
          paham diri.
        </Text>
        <Text
          variant="body"
          color="rgba(240,240,232,0.65)"
          style={{ marginTop: 16, maxWidth: 320 }}>
          AI yang bantu kelola pengeluaran, goal, dan kebiasaan finansial — dalam Bahasa Indonesia.
        </Text>
      </View>

      {/* CTAs */}
      <View
        style={{
          paddingTop: space.xxxl,
          paddingHorizontal: space.xl,
          paddingBottom: space.xl,
          gap: 10,
        }}>
        <Button
          variant="accent"
          label="Mulai gratis · 2 menit"
          icon="arrowR"
          onPress={() => router.push('/(auth)/register/email')}
        />
        <Button
          variant="outlineDark"
          label="Sudah punya akun? Masuk"
          onPress={() => router.push('/(auth)/login')}
        />
      </View>
    </Screen>
  );
}
