import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Field, Screen, Text } from '@/components/ui';
import { StepHeader } from '@/features/auth/components/step-header';
import { useSignupStore } from '@/features/auth/signup-store';
import { palette, radius, space } from '@/theme';

// const SUGGESTIONS = ['Del', 'Adel', 'Lia', 'Adelia R.', 'Kak Del'];

export function SignupNameScreen() {
  const router = useRouter();
  const nickname = useSignupStore((s) => s.nickname);
  const setStore = useSignupStore((s) => s.set);
  const [editing, setEditing] = useState(false);

  const canContinue = nickname.trim().length > 0 && nickname.trim().length <= 30;

  return (
    <Screen background={palette.bg} bottomInset={8}>
      <StepHeader step={1} total={2} />

      <View style={{ paddingTop: space.xl, paddingHorizontal: space.xxl }}>
        <Text variant="eyebrow" color={palette.cool} style={{ letterSpacing: 1.5 }}>
          Langkah 1 dari 2
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
        {editing ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: palette.card,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: palette.cool,
            }}>
            <Text variant="bodySm" color={palette.inkMute} style={{ marginBottom: 4 }}>
              Nama panggilan
            </Text>
            <TextInput
              value={nickname}
              onChangeText={(t) => setStore('nickname', t.slice(0, 30))}
              placeholder="Tulis di sini"
              placeholderTextColor={palette.inkMute}
              autoFocus
              style={{
                fontSize: 24,
                fontFamily: 'BricolageGrotesque_500Medium',
                color: palette.ink,
              }}
              onBlur={() => setEditing(false)}
            />
          </View>
        ) : (
          <View onTouchEnd={() => setEditing(true)}>
            <Field
              label="Nama panggilan"
              value={nickname || 'Tulis di sini'}
              focused
              caret
              radius={radius.xl}
              valueVariant="displayInput"
            />
          </View>
        )}

        {/* <View style={{ marginTop: 18 }}>
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
                onPress={() => setStore('nickname', s)}
              />
            ))}
          </View>
        </View> */}
      </View>

      <View style={{ flex: 1, minHeight: space.xl }} />

      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        <Button
          variant="primary"
          label="Lanjut"
          icon="arrowR"
          fullWidth
          disabled={!canContinue}
          onPress={() => router.push('/(auth)/register/income')}
        />
      </View>
    </Screen>
  );
}
