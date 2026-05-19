import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { BackButton, Screen, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';

type NotifType = 'ai' | 'budget' | 'tx' | 'streak' | 'goal' | 'review';

type NotifItem = {
  type: NotifType;
  t: string;
  b: string;
  tm: string;
  isNew?: boolean;
};

type Group = { h: string; items: NotifItem[] };

const GROUPS: Group[] = [
  {
    h: 'Hari ini',
    items: [
      {
        type: 'ai',
        t: 'Pengeluaran kopi naik 38%',
        b: 'Mau buat aturan otomatis?',
        tm: '08:12',
        isNew: true,
      },
      {
        type: 'budget',
        t: 'Budget Senang-Senang 70% penuh',
        b: 'Tersisa Rp 360rb sampai akhir bulan',
        tm: '07:30',
      },
      {
        type: 'tx',
        t: 'Pembayaran QRIS · Indomaret',
        b: '−Rp 87.500 · BCA •••432',
        tm: '06:20',
      },
    ],
  },
  {
    h: 'Minggu ini',
    items: [
      {
        type: 'streak',
        t: '🔥 7 hari catat pengeluaran!',
        b: 'Tanaman "tabung Rp 50rb" tumbuh',
        tm: 'Sen, 15:00',
      },
      {
        type: 'goal',
        t: 'Liburan Bali 74% tercapai',
        b: 'Tinggal Rp 3,4jt lagi · 14 Sep',
        tm: 'Min, 19:00',
      },
      {
        type: 'review',
        t: 'Rangkuman mingguan siap',
        b: 'Tap untuk lihat 3 wawasan dari Rapih',
        tm: 'Min, 19:00',
      },
    ],
  },
];

const TYPE_META: Record<NotifType, { c: string; bg: string; emoji: string }> = {
  ai: { c: palette.moss, bg: palette.limeSoft, emoji: '✦' },
  budget: { c: palette.coral, bg: tint.peach, emoji: '◷' },
  tx: { c: palette.ink, bg: palette.sand, emoji: '↗' },
  streak: { c: tint.goldInk, bg: tint.amber, emoji: '🔥' },
  goal: { c: palette.cool, bg: palette.limeSoft, emoji: '◇' },
  review: { c: tint.irisInk, bg: tint.iris, emoji: '☼' },
};

export function NotifikasiScreen() {
  const router = useRouter();
  return (
    <Screen background={palette.bg} bottomInset={28}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 22,
        }}>
        <BackButton
          onPress={() => {
            haptics.tap();
            if (router.canGoBack()) router.back();
          }}
        />
        <Text variant="figureS" style={{ fontSize: 22, letterSpacing: -0.5, lineHeight: 24 }}>
          Notifikasi
        </Text>
        <Pressable onPress={() => haptics.tap()} hitSlop={8}>
          <Text
            variant="bodySm"
            color={palette.cool}
            style={{ fontSize: 12, fontWeight: '600' }}>
            Baca semua
          </Text>
        </Pressable>
      </View>

      {GROUPS.map((g) => (
        <View key={g.h} style={{ marginHorizontal: 18, marginTop: 22 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
            {g.h}
          </Text>
          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: 22,
              borderCurve: 'continuous',
            }}>
            {g.items.map((n, i) => {
              const m = TYPE_META[n.type];
              return (
                <Pressable
                  key={`${g.h}-${i}`}
                  onPress={() => haptics.tap()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderBottomWidth: i < g.items.length - 1 ? 1 : 0,
                    borderBottomColor: palette.inkFaint,
                  }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: m.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                    <Text
                      color={m.c}
                      style={{ fontSize: 14, fontWeight: '700' }}>
                      {m.emoji}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}>
                      <Text
                        variant="bodySm"
                        style={{ flex: 1, fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
                        {n.t}
                      </Text>
                      <Text
                        variant="mono"
                        color={palette.inkMute}
                        style={{ fontSize: 10.5 }}>
                        {n.tm}
                      </Text>
                    </View>
                    <Text
                      variant="bodySm"
                      color={palette.inkSoft}
                      style={{ fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                      {n.b}
                    </Text>
                  </View>
                  {n.isNew && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 18,
                        right: 14,
                        width: 7,
                        height: 7,
                        borderRadius: 7,
                        backgroundColor: palette.coral,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}
