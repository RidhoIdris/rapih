import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { RapihMark, RapihWordmark } from '@/components/brand';
import { BackButton, Button, Glow, Screen, Text } from '@/components/ui';
import { signInWithGoogle } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { googleSignIn } from '@/features/auth/google-signin';
import { palette, space } from '@/theme';

export function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await googleSignIn();
      if (result.kind === 'cancelled') {
        return; // user backed out — silent
      }
      if (result.kind !== 'success') {
        Alert.alert('Gagal masuk', `Google sign-in: ${result.kind}`);
        return;
      }

      const session = await signInWithGoogle(result.idToken);
      await setSession({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: session.user,
      });

      // Route based on onboarding state
      if (session.user.onboarding_completed_at) {
        router.replace('/(app)/beranda' as Href);
      } else {
        router.replace('/(auth)/register/name');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      Alert.alert('Gagal masuk', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background={palette.moss} bottomInset={8}>
      <Glow size={360} opacity={0.4} fadeAt={0.65} position={{ top: -80, right: -100 }} />

      {/* nav */}
      <View
        style={{
          paddingTop: space.xl,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <BackButton />
        <RapihWordmark size={14} color={palette.onDark} accent={palette.lime} />
        <View style={{ width: 38 }} />
      </View>

      <View style={{ flex: 1 }} />

      {/* hero */}
      <View style={{ paddingHorizontal: space.xxl, alignItems: 'center' }}>
        <RapihMark size={56} color={palette.lime} accent={palette.onDark} />
        <Text
          variant="eyebrow"
          color={palette.lime}
          style={{ letterSpacing: 1.8, marginTop: 24 }}>
          Mulai dalam satu ketukan
        </Text>
        <Text
          variant="displayL"
          color={palette.onDark}
          style={{ marginTop: 12, textAlign: 'center' }}>
          Masuk dengan{'\n'}
          <Text variant="displayL" color={palette.lime} style={{ fontStyle: 'italic' }}>
            akun Google
          </Text>
          mu.
        </Text>
        <Text
          variant="body"
          color="rgba(240,240,232,0.65)"
          style={{ marginTop: 14, maxWidth: 300, textAlign: 'center' }}>
          Tidak perlu password. Aman, cepat, dan datamu tetap pribadi.
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 12 }}>
        <Button
          variant="accent"
          label={busy ? 'Memproses…' : 'Lanjut dengan Google'}
          icon="arrowR"
          fullWidth
          onPress={handleGoogle}
          disabled={busy}
        />
        <Text
          variant="bodySm"
          color="rgba(240,240,232,0.55)"
          style={{ textAlign: 'center', fontSize: 11.5, marginTop: 4 }}>
          Sign in with Apple akan ditambahkan segera.
        </Text>
      </View>
    </Screen>
  );
}
