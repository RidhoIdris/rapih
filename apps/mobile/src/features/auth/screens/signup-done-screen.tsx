import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { RapihWordmark } from '@/components/brand';
import { Icon } from '@/components/icons/icon';
import { Button, Glow, Screen, Text } from '@/components/ui';
import { patchOnboarding } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSignupStore } from '@/features/auth/signup-store';
import { palette, radius, space } from '@/theme';

const STEPS = [
  { t: 'Tambah dompet pertama', s: 'Pilih bank / e-wallet / cash', d: '· 2 menit' },
  { t: 'Catat 3 pengeluaran kemarin', s: 'Biar Rapih kenal ritme kamu', d: '· 1 menit' },
  { t: 'Buat goal pertama', s: 'Misalnya: dana darurat / liburan', d: '· 1 menit' },
];

export function SignupDoneScreen() {
  const router = useRouter();
  const { nickname, income, goal, reset } = useSignupStore();
  const setUser = useAuthStore((s) => s.setUser);
  const [busy, setBusy] = useState(false);

  const enterApp = async () => {
    if (busy) return;
    if (!nickname.trim() || !income || !goal) {
      Alert.alert('Data belum lengkap', 'Lengkapi semua langkah onboarding dulu.');
      router.replace('/(auth)/register/name');
      return;
    }

    setBusy(true);
    try {
      const updatedUser = await patchOnboarding({
        nickname: nickname.trim(),
        income_range: income,
        primary_goal: goal,
      });
      setUser(updatedUser);
      reset();
      router.replace('/(app)/beranda' as Href);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      Alert.alert('Gagal menyimpan', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background={palette.moss} bottomInset={8}>
      <Glow size={480} opacity={0.32} fadeAt={0.65} position={{ top: -120, alignSelf: 'center' }} />

      <View
        style={{
          paddingTop: space.xxl,
          paddingHorizontal: space.xxl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <RapihWordmark size={14} color={palette.onDark} accent={palette.lime} />
        <Text variant="bodySm" color="rgba(240,240,232,0.6)">
          Selesai
        </Text>
      </View>

      {/* big check */}
      <View style={{ paddingTop: 60, paddingHorizontal: space.xxl, alignItems: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 96,
            backgroundColor: palette.lime,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 14px rgba(184,232,194,0.12), 0 0 0 28px rgba(184,232,194,0.06)',
          }}>
          <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
            <Path
              d="M10 21l7 7L31 13"
              stroke={palette.moss}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text variant="eyebrow" color={palette.lime} style={{ letterSpacing: 1.8, marginTop: 36 }}>
          Akun siap dipakai
        </Text>
        <Text
          variant="displayL"
          color={palette.onDark}
          style={{ marginTop: 12, textAlign: 'center' }}>
          Selamat datang,{'\n'}
          <Text variant="displayL" color={palette.lime} style={{ fontStyle: 'italic' }}>
            {nickname || 'teman'}
          </Text>
          .
        </Text>
        <Text
          variant="body"
          color="rgba(240,240,232,0.7)"
          style={{ marginTop: 14, maxWidth: 300, textAlign: 'center' }}>
          Yuk mulai dengan tambah dompet pertama — bisa rekening, e-wallet, atau cash.
        </Text>
      </View>

      {/* quick-start checklist */}
      <View
        style={{
          marginTop: 36,
          marginHorizontal: space.xl,
          paddingHorizontal: space.sm,
          paddingVertical: 6,
          borderRadius: radius.xl,
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}>
        {STEPS.map((r, i) => (
          <View
            key={r.t}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderBottomWidth: i < STEPS.length - 1 ? 1 : 0,
              borderBottomColor: 'rgba(255,255,255,0.08)',
            }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: 'rgba(184,232,194,0.4)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text variant="mono" color={palette.lime} style={{ fontSize: 10 }}>
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                variant="bodySm"
                color={palette.onDark}
                style={{ fontSize: 13, fontWeight: '600' }}>
                {r.t}
              </Text>
              <Text
                variant="bodySm"
                color="rgba(240,240,232,0.55)"
                style={{ fontSize: 11, marginTop: 1 }}>
                {r.s} {r.d}
              </Text>
            </View>
            <Icon name="arrowR" size={12} color="rgba(240,240,232,0.5)" />
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: space.lg }} />

      <View style={{ paddingTop: 14, paddingHorizontal: space.xl, paddingBottom: space.xxl }}>
        <Button
          variant="accent"
          label={busy ? 'Menyimpan…' : 'Mulai pakai Rapih'}
          icon="arrowR"
          fullWidth
          disabled={busy}
          onPress={enterApp}
        />
      </View>
    </Screen>
  );
}
