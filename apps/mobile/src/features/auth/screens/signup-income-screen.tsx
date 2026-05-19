import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, radius, space } from '@/theme';
import { Button, Screen, Text } from '@/components/ui';
import { StepHeader } from '@/features/auth/components/step-header';
import {
  useSignupStore,
  type IncomeRange,
  type PrimaryGoal,
} from '@/features/auth/signup-store';

const RANGES: { id: IncomeRange; label: string; sub: string }[] = [
  { id: 'lt3', label: '< Rp 3jt', sub: 'Awal karier' },
  { id: '3to7', label: 'Rp 3 – 7jt', sub: 'Junior / freelance' },
  { id: '7to15', label: 'Rp 7 – 15jt', sub: 'Profesional' },
  { id: '15to30', label: 'Rp 15 – 30jt', sub: 'Senior / dual income' },
  { id: 'gt30', label: '> Rp 30jt', sub: 'Manajerial / bisnis' },
  { id: 'variable', label: 'Belum tetap', sub: 'Mahasiswa / variable' },
];

const GOALS: { id: PrimaryGoal; emoji: string; label: string }[] = [
  { id: 'save', emoji: '💰', label: 'Mulai nabung' },
  { id: 'track', emoji: '📊', label: 'Catat pengeluaran' },
  { id: 'goal', emoji: '🏖️', label: 'Wujudkan goal' },
  { id: 'invest', emoji: '📈', label: 'Mulai investasi' },
  { id: 'debt', emoji: '💳', label: 'Lunasi utang' },
  { id: 'bills', emoji: '📆', label: 'Atur tagihan rutin' },
];

const SectionLabel = ({ children }: { children: string }) => (
  <Text
    variant="label"
    color={palette.inkMute}
    style={{ fontSize: 10.5, letterSpacing: 1.3, paddingHorizontal: space.xs, paddingBottom: 8 }}>
    {children}
  </Text>
);

export function SignupIncomeScreen() {
  const router = useRouter();
  const { income, goal, set } = useSignupStore();

  return (
    <Screen background={palette.bg} topInset={16} bottomInset={4}>
      <StepHeader step={3} onSkip={() => router.replace('/(auth)/done')} />

      <View style={{ paddingTop: space.xl, paddingHorizontal: space.xxl }}>
        <Text variant="eyebrow" color={palette.cool} style={{ letterSpacing: 1.5 }}>
          Langkah 3 dari 3
        </Text>
        <Text variant="displayS" style={{ marginTop: 8 }}>
          Biar Rapih bisa{'\n'}kasih saran{' '}
          <Text variant="displayS" color={palette.cool} style={{ fontStyle: 'italic' }}>
            pas
          </Text>
          .
        </Text>
      </View>

      {/* income range */}
      <View style={{ paddingTop: space.xl, paddingHorizontal: space.xl }}>
        <SectionLabel>PENGHASILAN / BULAN</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {RANGES.map((r) => {
            const selected = income === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => set('income', r.id)}
                style={{
                  width: '48.4%',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: radius.md,
                  backgroundColor: selected ? palette.ink : palette.card,
                  borderWidth: selected ? 0 : 1,
                  borderColor: palette.inkFaint,
                }}>
                <Text
                  variant="mono"
                  color={selected ? palette.onDark : palette.ink}
                  style={{ fontSize: 12.5 }}>
                  {r.label}
                </Text>
                <Text
                  variant="bodySm"
                  color={selected ? 'rgba(240,240,232,0.65)' : palette.inkMute}
                  style={{ fontSize: 10.5, marginTop: 2 }}>
                  {r.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* primary goal */}
      <View style={{ paddingTop: 18, paddingHorizontal: space.xl }}>
        <SectionLabel>TUJUAN UTAMA · PILIH 1</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {GOALS.map((g) => {
            const selected = goal === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => set('goal', g.id)}
                style={{
                  width: '31.8%',
                  paddingVertical: 12,
                  paddingHorizontal: 6,
                  borderRadius: radius.md,
                  backgroundColor: selected ? palette.lime : palette.card,
                  borderWidth: selected ? 0 : 1,
                  borderColor: palette.inkFaint,
                  alignItems: 'center',
                  gap: 4,
                }}>
                <Text style={{ fontSize: 18 }}>{g.emoji}</Text>
                <Text
                  variant="bodySm"
                  color={selected ? palette.moss : palette.ink}
                  style={{ fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1, minHeight: space.lg }} />

      <View style={{ paddingTop: 14, paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        <Button
          variant="primary"
          label="Selesai"
          icon="arrowR"
          fullWidth
          onPress={() => router.replace('/(auth)/done')}
        />
      </View>
    </Screen>
  );
}
