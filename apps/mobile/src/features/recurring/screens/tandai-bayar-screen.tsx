import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { palette } from '@/theme';
import { Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const META: [string, string, string, string | null][] = [
  ['🏦', 'Dibayar dari', 'BCA Tahapan · ····432', 'Saldo Rp 8,4jt'],
  ['📅', 'Tanggal bayar', 'Hari ini · 17 Mei', '8 hari lebih cepat'],
  ['📝', 'Catatan (opsional)', '—', null],
];

export function TandaiBayarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = () => {
    haptics.tap();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(28,36,24,0.55)', justifyContent: 'flex-end' }}>
      <StatusBar style="light" />

      {/* faded peek behind */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: insets.top + 14, left: 18, right: 18, opacity: 0.4 }}>
        <Text variant="displayS" color={ONDARK} style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32 }}>
          Pengeluaran{'\n'}Rutin
        </Text>
      </View>

      {/* tap-to-dismiss area */}
      <Pressable style={{ flex: 1 }} onPress={close} />

      {/* sheet */}
      <View
        style={{
          backgroundColor: palette.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: 'continuous',
          paddingBottom: insets.bottom + 20,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.18)',
        }}>
        {/* grabber */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 46, height: 5, borderRadius: 5, backgroundColor: palette.inkFaint }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 22,
              paddingTop: 8,
            }}>
            <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
              Tandai Sudah Dibayar
            </Text>
            <Pressable
              onPress={close}
              style={{
                width: 30,
                height: 30,
                borderRadius: 30,
                backgroundColor: palette.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="x" size={12} color={palette.ink} />
            </Pressable>
          </View>

          {/* notice */}
          <View
            style={{
              marginHorizontal: 18,
              marginTop: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: palette.limeSoft,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}>
            <Text style={{ fontSize: 14 }}>ℹ️</Text>
            <Text variant="bodySm" color={palette.moss} style={{ flex: 1, fontSize: 11.5, lineHeight: 17 }}>
              Rapih belum terhubung ke bank. Catat di sini cukup buat tracking
              pribadi — belum jadi transaksi otomatis.
            </Text>
          </View>

          {/* hero */}
          <View style={{ paddingHorizontal: 28, paddingTop: 18, alignItems: 'center' }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: '#0060af',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 24 }}>🏠</Text>
            </View>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: '600', marginTop: 12 }}>
              KPR Rumah · BCA · cicilan ke-33
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 4 }}>
              Jatuh tempo 25 Mei 2026 · 8 hari lagi
            </Text>
          </View>

          {/* amount */}
          <View style={{ marginHorizontal: 18, marginTop: 14 }}>
            <Text
              variant="label"
              color={palette.inkMute}
              style={{ fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 6 }}>
              Nominal dibayar
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
                boxShadow: `0 0 0 1.5px ${palette.lime}, 0 4px 18px ${palette.limeSoft}`,
              }}>
              <Text variant="figureS" color={palette.inkMute} style={{ fontSize: 22 }}>
                Rp
              </Text>
              <Text variant="figureM" style={{ flex: 1, fontSize: 32, letterSpacing: -1, lineHeight: 34 }}>
                5.800.000
              </Text>
              <View style={{ width: 2, height: 24, backgroundColor: palette.ink }} />
              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  backgroundColor: palette.limeSoft,
                }}>
                <Text variant="chip" color={palette.moss} style={{ fontSize: 10, fontWeight: '700' }}>
                  = tagihan
                </Text>
              </View>
            </View>
          </View>

          {/* meta rows */}
          <View
            style={{
              marginHorizontal: 18,
              marginTop: 14,
              backgroundColor: palette.card,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 4,
            }}>
            {META.map((r, i) => (
              <View
                key={r[1]}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderBottomWidth: i < META.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <Text style={{ fontSize: 16 }}>{r[0]}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="label"
                    color={palette.inkMute}
                    style={{ fontSize: 10, letterSpacing: 0.5, fontWeight: '700' }}>
                    {r[1]}
                  </Text>
                  <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                    {r[2]}
                  </Text>
                </View>
                {r[3] && (
                  <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
                    {r[3]}
                  </Text>
                )}
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 14 }}>
                  ›
                </Text>
              </View>
            ))}
          </View>

          {/* attach struk */}
          <View
            style={{
              marginHorizontal: 18,
              marginTop: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              boxShadow: `0 0 0 1px ${palette.inkFaint}`,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: palette.sand,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 16 }}>📎</Text>
            </View>
            <Text variant="bodySm" color={palette.inkSoft} style={{ flex: 1, fontSize: 12.5 }}>
              Lampirkan bukti transfer / struk
            </Text>
            <Text variant="bodySm" style={{ fontSize: 11, fontWeight: '700' }}>
              Pilih
            </Text>
          </View>

          {/* CTA */}
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <Pressable
              onPress={() => {
                haptics.success();
                router.back();
              }}
              style={{
                height: 54,
                borderRadius: 27,
                backgroundColor: palette.moss,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
              <Icon name="check" size={14} color={ONDARK} />
              <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
                Tandai cicilan ke-33 lunas
              </Text>
            </Pressable>
            <Text
              variant="bodySm"
              color={palette.inkSoft}
              style={{ marginTop: 10, textAlign: 'center', fontSize: 11 }}>
              Pengingat berikutnya dijadwalkan 25 Juni
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
