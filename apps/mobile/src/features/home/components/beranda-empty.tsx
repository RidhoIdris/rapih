import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Monogram } from '@/components/brand';
import { Icon } from '@/components/icons/icon';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { palette, tint } from '@/theme';

const ONDARK = palette.onDark;

type Step = {
  n: number;
  t: string;
  s: string;
  d: string;
  cta: string;
  icon: string;
  accent: string;
  accentTxt: string;
  to: Href;
  primary?: boolean;
};

const STEPS: Step[] = [
  {
    n: 1,
    t: 'Tambah dompet pertama',
    s: 'BCA, GoPay, atau cash — bebas.',
    d: '2 menit',
    cta: 'Tambah dompet',
    icon: '👛',
    accent: palette.lime,
    accentTxt: palette.moss,
    to: '/(app)/tambah-dompet' as Href,
    primary: true,
  },
  {
    n: 2,
    t: 'Catat 3 pengeluaran kemarin',
    s: 'Biar Rapih kenal ritme kamu.',
    d: '1 menit',
    cta: 'Catat sekarang',
    icon: '✎',
    accent: tint.amber,
    accentTxt: tint.amberInk,
    to: '/(app)/tambah-transaksi' as Href,
  },
  {
    n: 3,
    t: 'Buat goal pertama',
    s: 'Dana darurat, liburan, atau gadget.',
    d: '30 detik',
    cta: 'Buat goal',
    icon: '◇',
    accent: palette.limeSoft,
    accentTxt: palette.moss,
    to: '/(app)/tambah-goal' as Href,
  },
];

const TIPS = [
  { t: 'Apa itu dana darurat?', s: '3 menit baca', c: tint.amber, tc: tint.amberInk },
  { t: 'Cara budgeting 50/30/20', s: '5 menit baca', c: palette.limeSoft, tc: palette.moss },
  { t: 'Reksadana untuk pemula', s: '4 menit baca', c: tint.peach, tc: tint.peachInk },
];

/** Beranda for a brand-new user (no wallet yet) — an onboarding checklist. */
export function BerandaEmpty({ name }: { name: string }) {
  const router = useRouter();
  const initials = name.trim().slice(0, 2).toUpperCase() || 'RP';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={96}>
        {/* top bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Monogram initials={initials} bg={palette.moss} fg={palette.lime} size={38} />
            <View>
              <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
                Halo, kenalan dulu
              </Text>
              <Text variant="bodySm" style={{ fontSize: 15, fontWeight: '600', letterSpacing: -0.3 }}>
                {name}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/(app)/notifikasi' as Href);
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 38,
              backgroundColor: palette.card,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 1px 2px rgba(10,10,14,0.04), 0 0 0 1px ${palette.inkFaint}`,
            }}>
            <Icon name="bell" size={16} color={palette.ink} />
          </Pressable>
        </View>

        {/* hero — "mulai dari nol" */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 22,
            padding: 22,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            overflow: 'hidden',
          }}>
          <Glow size={220} color={palette.lime} opacity={0.3} fadeAt={0.65} position={{ top: -80, right: -80 }} />
          <Text variant="eyebrow" color={palette.lime} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
            Mulai dari nol
          </Text>
          <Text
            variant="figureL"
            color={ONDARK}
            style={{ fontSize: 32, letterSpacing: -1.4, lineHeight: 34, marginTop: 10 }}>
            Yuk kenalin{' '}
            <Text variant="figureL" color={palette.lime} style={{ fontSize: 32, fontStyle: 'italic' }}>
              uangmu
            </Text>{' '}
            ke Rapih.
          </Text>
          <Text
            variant="body"
            color="rgba(240,240,232,0.7)"
            style={{ fontSize: 13, lineHeight: 19.5, marginTop: 12, maxWidth: 300 }}>
            Tiga langkah singkat, total 3 menit. Rapih bakal langsung kasih insight begitu ada data.
          </Text>
        </View>

        {/* checklist */}
        <View style={{ marginHorizontal: 18, marginTop: 14, gap: 8 }}>
          {STEPS.map((r) => (
            <View
              key={r.n}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
                borderWidth: r.primary ? 1.5 : 1,
                borderColor: r.primary ? palette.lime : palette.inkFaint,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: r.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 20 }}>{r.icon}</Text>
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: 18,
                    backgroundColor: palette.ink,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text variant="mono" color={ONDARK} style={{ fontSize: 9, fontWeight: '700' }}>
                    {r.n}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2 }}>
                  {r.t}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                  {r.s} · {r.d}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push(r.to);
                }}
                style={{
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  backgroundColor: r.primary ? palette.moss : 'transparent',
                  boxShadow: r.primary ? undefined : `0 0 0 1px ${palette.inkFaint}`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  variant="chip"
                  color={r.primary ? palette.lime : palette.ink}
                  style={{ fontSize: 12, fontWeight: '700' }}>
                  {r.cta}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* placeholder pulse card */}
        <View style={{ marginHorizontal: 18, marginTop: 24 }}>
          <View
            style={{
              paddingVertical: 16,
              paddingHorizontal: 18,
              borderRadius: 22,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.inkFaint,
              borderStyle: 'dashed',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 64,
                borderWidth: 6,
                borderColor: palette.sandDeep,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text variant="figureS" color={palette.inkMute} style={{ fontSize: 20 }}>
                —
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                variant="label"
                color={palette.inkMute}
                style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
                Pulse Keuangan
              </Text>
              <Text variant="figureS" style={{ fontSize: 18, marginTop: 2 }}>
                Belum bisa dihitung
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
                Tambah dompet & 1 transaksi biar Rapih mulai ngukur.
              </Text>
            </View>
          </View>
        </View>

        {/* tips ribbon */}
        <View style={{ marginTop: 20 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700', paddingHorizontal: 22, paddingBottom: 8 }}>
            Sambil nunggu, baca yuk
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}>
            {TIPS.map((c) => (
              <View
                key={c.t}
                style={{
                  width: 170,
                  padding: 16,
                  borderRadius: 18,
                  borderCurve: 'continuous',
                  backgroundColor: c.c,
                  gap: 12,
                }}>
                <Text style={{ fontSize: 22 }}>📖</Text>
                <View>
                  <Text variant="bodySm" color={c.tc} style={{ fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2, lineHeight: 17 }}>
                    {c.t}
                  </Text>
                  <Text variant="bodySm" color={c.tc} style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                    {c.s}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Screen>

      <TabBar active="beranda" />
    </View>
  );
}
