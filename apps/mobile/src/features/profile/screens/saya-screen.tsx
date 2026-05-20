import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Chip, Screen, TabBar, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { Monogram } from '@/components/brand';
import { haptics } from '@/lib/haptics';

type Stat = { l: string; v: string; sub: string };

const STATS: Stat[] = [
  { l: 'Hari rapih', v: '23', sub: 'streak' },
  { l: 'Budget aktif', v: '5', sub: 'kantong' },
  { l: 'Goal', v: '5', sub: '/2 selesai' },
];

type Row = {
  /** unicode glyph used as a visual icon inside the tile */
  icon: string;
  label: string;
  tail?: string;
  /** route to push when the row is tapped — undefined = no-op + haptic only */
  to?: string;
  danger?: boolean;
};

type Group = { title: string; items: Row[] };

const GROUPS: Group[] = [
  {
    title: 'Akun & finansial',
    items: [
      { icon: '◇', label: 'Dompet terhubung', tail: '8', to: '/(app)/dompet' },
      { icon: '☷', label: 'Profil & data pribadi' },
      { icon: '✦', label: 'Bahasa & mata uang', tail: 'ID · Rp', to: '/(app)/pengaturan' },
      { icon: '⌘', label: 'Ekspor data' },
    ],
  },
  {
    title: 'Notifikasi & AI',
    items: [
      { icon: '◔', label: 'Notifikasi push', to: '/(app)/pengaturan' },
      { icon: '☆', label: 'Pengingat kebiasaan', tail: 'aktif' },
      { icon: '✺', label: 'Rapih AI · gaya bahasa', tail: 'Santai', to: '/(app)/pengaturan' },
    ],
  },
  {
    title: 'Keamanan',
    items: [
      { icon: '⏚', label: 'Face ID', tail: 'aktif' },
      { icon: '⊡', label: 'PIN aplikasi' },
      { icon: '☁', label: 'Cadangan iCloud', tail: 'tiap hari' },
    ],
  },
  {
    title: 'Lainnya',
    items: [
      { icon: '◑', label: 'Tema tampilan', tail: 'Otomatis', to: '/(app)/pengaturan' },
      { icon: '?', label: 'Pusat bantuan' },
      { icon: '✉', label: 'Hubungi tim Rapih' },
      { icon: '✕', label: 'Keluar', danger: true },
    ],
  },
];

export function SayaScreen() {
  const router = useRouter();
  const goPengaturan = () => router.push('/(app)/pengaturan' as Href);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={110}>
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
          }}>
          <Text
            variant="displayS"
            style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 30 }}>
            Saya
          </Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              goPengaturan();
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 38,
              backgroundColor: palette.card,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 1px 2px rgba(10,10,14,0.04), 0 0 0 1px rgba(10,10,14,0.04)',
            }}>
            <Icon name="gear" size={16} color={palette.ink} />
          </Pressable>
        </View>

        {/* profile hero */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 22,
            paddingVertical: 22,
            paddingHorizontal: 20,
            borderRadius: 26,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
          <Monogram initials="AD" bg={palette.moss} fg={palette.lime} size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="figureS"
              style={{ fontSize: 22, letterSpacing: -0.5, lineHeight: 22 }}>
              Adelia R.
            </Text>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ fontSize: 12, marginTop: 6 }}>
              adelia.r@gmail.com
            </Text>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
              <Chip
                label="★ Pulse 78"
                bg={palette.lime}
                color={palette.moss}
                style={{ paddingVertical: 3, paddingHorizontal: 8 }}
              />
              <Chip
                label="Anggota sejak Mar 2026"
                bg={palette.sand}
                style={{ paddingVertical: 3, paddingHorizontal: 8 }}
              />
            </View>
          </View>
        </View>

        {/* stats */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 12,
            flexDirection: 'row',
            gap: 8,
          }}>
          {STATS.map((s) => (
            <View
              key={s.l}
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
                alignItems: 'center',
              }}>
              <Text
                variant="label"
                color={palette.inkMute}
                style={{ fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>
                {s.l}
              </Text>
              <Text
                variant="figureS"
                color={palette.moss}
                style={{ fontSize: 28, letterSpacing: -0.8, lineHeight: 32, marginTop: 4 }}>
                {s.v}
              </Text>
              <Text
                variant="bodySm"
                color={palette.inkMute}
                style={{ fontSize: 10.5, marginTop: 2 }}>
                {s.sub}
              </Text>
            </View>
          ))}
        </View>

        {/* menu groups */}
        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginHorizontal: 18, marginTop: 18 }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
              {g.title}
            </Text>
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 22,
                borderCurve: 'continuous',
              }}>
              {g.items.map((it, i) => (
                <Pressable
                  key={it.label}
                  onPress={() => {
                    haptics.tap();
                    if (it.to) router.push(it.to as Href);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: i < g.items.length - 1 ? 1 : 0,
                    borderBottomColor: palette.inkFaint,
                  }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      backgroundColor: it.danger ? tint.peach : palette.sand,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text
                      color={it.danger ? palette.coral : palette.moss}
                      style={{ fontSize: 13, fontWeight: '700' }}>
                      {it.icon}
                    </Text>
                  </View>
                  <Text
                    variant="bodySm"
                    color={it.danger ? palette.coral : palette.ink}
                    style={{ flex: 1, fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
                    {it.label}
                  </Text>
                  {it.tail && (
                    <Text
                      variant="bodySm"
                      color={palette.inkMute}
                      style={{ fontSize: 12 }}>
                      {it.tail}
                    </Text>
                  )}
                  {!it.danger && <Icon name="chevronR" size={12} color={palette.inkMute} />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* version footer */}
        <Text
          variant="mono"
          color={palette.inkMute}
          style={{ fontSize: 11, marginTop: 24, marginHorizontal: 18, textAlign: 'center' }}>
          rapih · v1.4.0 (build 1247)
        </Text>
      </Screen>

      <TabBar active="saya" />
    </View>
  );
}
