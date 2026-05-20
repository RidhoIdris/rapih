import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

type Tx = { d: string; amt: number; note: string };
type Group = {
  rule: { emoji: string; name: string; tile: string };
  tx: Tx[];
};

const LOG: Group[] = [
  {
    rule: { emoji: '💰', name: 'Round-up tabungan', tile: palette.limeSoft },
    tx: [
      { d: '17 Mei · 10:42', amt: 500, note: 'Tokopedia · sisa pembulatan' },
      { d: '17 Mei · 09:14', amt: 2000, note: 'GoFood · sisa pembulatan' },
      { d: '16 Mei · 18:30', amt: 4000, note: 'Indomaret · sisa pembulatan' },
      { d: '15 Mei · 12:08', amt: 1500, note: 'Starbucks · sisa pembulatan' },
    ],
  },
  {
    rule: { emoji: '🔔', name: 'Notif tagihan H-3', tile: tint.peach },
    tx: [
      { d: '15 Mei · 09:00', amt: 0, note: 'KPR Tahap 2 — jatuh tempo 18 Mei' },
      { d: '12 Mei · 09:00', amt: 0, note: 'Netflix — jatuh tempo 15 Mei' },
    ],
  },
  {
    rule: { emoji: '🚦', name: 'Cap Senang-Senang', tile: tint.amber },
    tx: [
      { d: '14 Mei · 16:20', amt: 0, note: '78% plafon kepakai — pelan-pelan' },
    ],
  },
];

export function AturanRiwayatScreen() {
  const router = useRouter();
  const totalTx = LOG.reduce((s, g) => s + g.tx.length, 0);

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
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="chevronLeft" size={14} color={palette.ink} />
        </Pressable>
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Riwayat Aturan
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* hero */}
      <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
          Catatan otomatis
        </Text>
        <Text
          variant="displayS"
          style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32, marginTop: 6 }}>
          Apa yang Rapih{'\n'}bantuin.
        </Text>
        <Text
          variant="body"
          color={palette.inkSoft}
          style={{ fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
          {totalTx} catatan dari aturan otomatis kamu. Tap Undo kalau salah —
          Rapih batalin tanpa drama.
        </Text>
      </View>

      {/* log groups */}
      <View style={{ marginTop: 22, gap: 14, paddingHorizontal: 18 }}>
        {LOG.map((g) => (
          <View
            key={g.rule.name}
            style={{
              backgroundColor: palette.card,
              borderRadius: 22,
              borderCurve: 'continuous',
              overflow: 'hidden',
            }}>
            {/* rule header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: 1,
                borderBottomColor: palette.inkFaint,
                backgroundColor: g.rule.tile,
              }}>
              <Text style={{ fontSize: 18, lineHeight: 22 }}>{g.rule.emoji}</Text>
              <Text
                variant="bodySm"
                style={{ flex: 1, fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2 }}>
                {g.rule.name}
              </Text>
              <Text
                variant="chip"
                color={palette.inkMute}
                style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
                {g.tx.length}×
              </Text>
            </View>

            {/* tx rows */}
            {g.tx.map((t, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < g.tx.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {t.amt === 0 ? (
                      <View
                        style={{
                          paddingVertical: 2,
                          paddingHorizontal: 7,
                          borderRadius: 999,
                          backgroundColor: palette.sand,
                        }}>
                        <Text
                          variant="chip"
                          color={palette.inkSoft}
                          style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 }}>
                          NOTIF
                        </Text>
                      </View>
                    ) : (
                      <Text variant="mono" style={{ fontSize: 12.5, fontWeight: '700' }}>
                        + {rupiah(t.amt)}
                      </Text>
                    )}
                    <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>
                      {t.d}
                    </Text>
                  </View>
                  <Text
                    variant="bodySm"
                    color={palette.inkSoft}
                    numberOfLines={1}
                    style={{ fontSize: 11.5, marginTop: 3 }}>
                    {t.note}
                  </Text>
                </View>
                <Pressable
                  onPress={() => haptics.tap()}
                  hitSlop={8}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: palette.sand,
                  }}>
                  <Text variant="chip" style={{ fontSize: 10.5, fontWeight: '700' }}>
                    Undo
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* footer note */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: palette.limeSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="leaf" size={14} color={palette.moss} />
        <Text
          variant="bodySm"
          color={palette.moss}
          style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
          Semua catatan ini cuma di Rapih. Gak gerakin uang asli di bank.
        </Text>
      </View>

      <View style={{ height: 12 }} />
    </Screen>
  );
}
