import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, space } from '@/theme';
import { RapihWordmark } from '@/components/brand';
import {
  BackButton,
  Button,
  Field,
  LabeledDivider,
  Screen,
  Text,
} from '@/components/ui';
import { useSignupStore } from '@/features/auth/signup-store';

const SOCIALS = ['Google', 'Apple', 'GoPay'] as const;

export function LoginScreen() {
  const router = useRouter();
  const email = useSignupStore((s) => s.email);

  return (
    <Screen background={palette.bg} bottomInset={8}>
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
        <RapihWordmark size={14} />
        <View style={{ width: 38 }} />
      </View>

      {/* hero */}
      <View style={{ paddingTop: space.xxxl, paddingHorizontal: space.xxl }}>
        <Text variant="eyebrow" color={palette.cool} style={{ letterSpacing: 1.5 }}>
          Selamat datang kembali
        </Text>
        <Text variant="displayL" style={{ marginTop: 8 }}>
          Lanjutkan{'\n'}
          <Text variant="displayL" color={palette.cool} style={{ fontStyle: 'italic' }}>
            cerita keuanganmu
          </Text>
          .
        </Text>
      </View>

      {/* form */}
      <View style={{ paddingTop: space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Field label="Email" value={email} />
        <Field
          label="Kata sandi"
          value="••••••••"
          focused
          valueStyle={{ fontSize: 18 }}
          valueLetterSpacing={4}
          trailing={
            <Text variant="bodySm" color={palette.cool} style={{ fontSize: 11 }}>
              Lihat
            </Text>
          }
        />
        <View style={{ alignItems: 'flex-end', paddingHorizontal: space.xs }}>
          <Text variant="bodySm" color={palette.inkSoft}>
            Lupa kata sandi?
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: space.xxl }} />

      {/* CTA + social */}
      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        <Button
          variant="primary"
          label="Masuk"
          icon="arrowR"
          fullWidth
          onPress={() => router.replace('/(auth)/done')}
        />

        <View style={{ paddingVertical: space.lg }}>
          <LabeledDivider label="atau lanjutkan dengan" />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {SOCIALS.map((p) => (
            <Button key={p} variant="social" label={p} fullWidth />
          ))}
        </View>

        <View
          style={{
            marginTop: space.lg,
            flexDirection: 'row',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" color={palette.inkSoft}>
            Belum punya akun?{' '}
          </Text>
          <Text
            variant="bodySm"
            color={palette.ink}
            onPress={() => router.push('/(auth)/register/email')}
            style={{
              fontWeight: '600',
              textDecorationLine: 'underline',
            }}>
            Daftar gratis
          </Text>
        </View>
      </View>
    </Screen>
  );
}
