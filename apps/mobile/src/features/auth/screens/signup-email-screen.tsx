import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, radius, space } from '@/theme';
import { Icon } from '@/components/icons/icon';
import {
  Button,
  Field,
  LabeledDivider,
  Screen,
  Text,
} from '@/components/ui';
import { StepHeader } from '@/features/auth/components/step-header';
import { useSignupStore } from '@/features/auth/signup-store';

const SOCIALS = ['Google', 'Apple', 'GoPay'] as const;

export function SignupEmailScreen() {
  const router = useRouter();
  const email = useSignupStore((s) => s.email);

  return (
    <Screen background={palette.bg} bottomInset={8}>
      <StepHeader step={1} />

      <View style={{ paddingTop: space.xxl, paddingHorizontal: space.xxl }}>
        <Text variant="eyebrow" color={palette.cool} style={{ letterSpacing: 1.5 }}>
          Langkah 1 dari 3
        </Text>
        <Text variant="displayM" style={{ marginTop: 8 }}>
          Mulai gratis,{'\n'}tanpa{' '}
          <Text variant="displayM" color={palette.cool} style={{ fontStyle: 'italic' }}>
            ribet
          </Text>
          .
        </Text>
        <Text variant="body" color={palette.inkSoft} style={{ marginTop: 10 }}>
          Cuma butuh email dan kata sandi. Datamu pribadi, gak dibagi ke siapapun.
        </Text>
      </View>

      <View style={{ paddingTop: space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Field label="Email" value={email} focused caret />
        <Field
          label="Kata sandi"
          placeholder="min. 8 karakter"
          trailing={
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
              Lihat
            </Text>
          }
        />

        {/* T&C consent */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            paddingHorizontal: space.xs,
            paddingVertical: 6,
          }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: radius.sm,
              backgroundColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}>
            <Icon name="check" size={12} color={palette.lime} />
          </View>
          <Text variant="body" color={palette.inkSoft} style={{ flex: 1, fontSize: 11.5 }}>
            Saya setuju dengan{' '}
            <Text color={palette.ink} style={{ fontWeight: '600', textDecorationLine: 'underline' }}>
              Syarat &amp; Ketentuan
            </Text>{' '}
            dan{' '}
            <Text color={palette.ink} style={{ fontWeight: '600', textDecorationLine: 'underline' }}>
              Kebijakan Privasi
            </Text>{' '}
            Rapih.
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: space.xl }} />

      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        <Button
          variant="primary"
          label="Buat akun"
          icon="arrowR"
          fullWidth
          onPress={() => router.push('/(auth)/register/name')}
        />
        <View style={{ paddingVertical: space.lg }}>
          <LabeledDivider label="atau" />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {SOCIALS.map((p) => (
            <Button key={p} variant="social" label={p} fullWidth />
          ))}
        </View>
      </View>
    </Screen>
  );
}
