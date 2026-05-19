import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, radius, space } from '@/theme';
import { Button, Chip, Field, Screen, Text } from '@/components/ui';
import { StepHeader } from '@/features/auth/components/step-header';
import { useSignupStore } from '@/features/auth/signup-store';

const SUGGESTIONS = ['Del', 'Adel', 'Lia', 'Adelia R.', 'Kak Del'];

export function SignupNameScreen() {
  const router = useRouter();
  const nickname = useSignupStore((s) => s.nickname);
  const set = useSignupStore((s) => s.set);

  return (
    <Screen background={palette.bg} bottomInset={8}>
      <StepHeader step={2} onSkip={() => router.push('/(auth)/register/income')} />

      <View style={{ paddingTop: space.xl, paddingHorizontal: space.xxl }}>
        <Text variant="eyebrow" color={palette.cool} style={{ letterSpacing: 1.5 }}>
          Langkah 2 dari 3
        </Text>
        <Text variant="displayM" style={{ marginTop: 8 }}>
          Halo!{'\n'}Siapa{' '}
          <Text variant="displayM" color={palette.cool} style={{ fontStyle: 'italic' }}>
            nama panggilan
          </Text>
          mu?
        </Text>
        <Text variant="body" color={palette.inkSoft} style={{ marginTop: 10, fontSize: 13 }}>
          Rapih bakal manggil kamu dengan nama ini. Bebas, gak harus nama asli.
        </Text>
      </View>

      <View style={{ paddingTop: space.xxxl, paddingHorizontal: space.xl }}>
        <Field
          label="Nama panggilan"
          value={nickname}
          focused
          caret
          radius={radius.xl}
          valueVariant="displayInput"
        />

        <View style={{ marginTop: 18 }}>
          <Text
            variant="bodySm"
            color={palette.inkMute}
            style={{ fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 }}>
            Atau pilih panggilan singkat:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                label={s}
                bg={palette.card}
                ringed
                onPress={() => set('nickname', s)}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: space.xl }} />

      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        <Button
          variant="primary"
          label="Lanjut"
          icon="arrowR"
          fullWidth
          onPress={() => router.push('/(auth)/register/income')}
        />
      </View>
    </Screen>
  );
}
