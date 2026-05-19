import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Glow, Text } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const LUNAS = 32;
const TOTAL_CICILAN = 60;
const PCT = Math.round((LUNAS / TOTAL_CICILAN) * 100);

const META: [string, string][] = [
  ['Mulai cicilan', 'Sep 2023'],
  ['Selesai (proyeksi)', 'Agu 2043'],
  ['Total dibayar', 'Rp 185,6jt'],
  ['Sisa pokok', 'Rp 162,4jt'],
  ['Bunga efektif', '6,75% / tahun'],
  ['Auto debit', 'Aktif · tiap tgl 25'],
];

const HISTORY = [
  { d: '25 Apr 2026', amt: 5800000, status: 'paid' as const, src: 'BCA · auto' },
  { d: '25 Mar 2026', amt: 5800000, status: 'paid' as const, src: 'BCA · auto' },
  { d: '25 Feb 2026', amt: 5800000, status: 'paid' as const, src: 'BCA · auto' },
  { d: '25 Jan 2026', amt: 5800000, status: 'late' as const, src: 'BCA · manual, +3 hari' },
  { d: '25 Dec 2025', amt: 5800000, status: 'paid' as const, src: 'BCA · auto' },
];

function HeaderBtn({ name, onPress }: { name: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 38,
        backgroundColor: palette.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={name} size={name === 'chevronLeft' ? 14 : 16} color={palette.ink} />
    </Pressable>
  );
}

export function RecurringDetailScreen() {
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
        <HeaderBtn
          name="chevronLeft"
          onPress={() => {
            haptics.tap();
            router.back();
          }}
        />
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Detail Tagihan
        </Text>
        <HeaderBtn name="more" onPress={() => haptics.tap()} />
      </View>

      {/* hero */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 20,
          padding: 22,
          borderRadius: 26,
          borderCurve: 'continuous',
          backgroundColor: '#0060af',
          overflow: 'hidden',
          boxShadow: '0 12px 28px rgba(0,96,175,0.28)',
        }}>
        <Glow size={180} color="#ffffff" opacity={0.16} fadeAt={0.7} position={{ top: -40, right: -40 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 24 }}>🏠</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant="label"
              color="rgba(255,255,255,0.7)"
              style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
              KPR Rumah · BCA
            </Text>
            <Text variant="figureS" color="#fff" style={{ fontSize: 22, letterSpacing: -0.6, lineHeight: 24, marginTop: 4 }}>
              Cicilan bulanan
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text variant="figureXL" color="#fff" style={{ fontSize: 44, letterSpacing: -1.8, lineHeight: 46 }}>
            Rp 5,8jt
          </Text>
          <Text variant="bodySm" color="rgba(255,255,255,0.7)" style={{ fontSize: 11.5 }}>
            / bulan · tgl 25
          </Text>
        </View>
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="bodySm" color="rgba(255,255,255,0.75)" style={{ fontSize: 10.5, fontWeight: '600' }}>
              Cicilan ke-{LUNAS} dari {TOTAL_CICILAN}
            </Text>
            <Text variant="mono" color="rgba(255,255,255,0.75)" style={{ fontSize: 10.5 }}>
              {PCT}% lunas
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${PCT}%`, backgroundColor: '#fff', borderRadius: 8 }} />
          </View>
        </View>
      </View>

      {/* upcoming alert */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 12,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: tint.amber,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: tint.goldInk,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 20 }}>⏰</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={tint.amberInk} style={{ fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2 }}>
            Jatuh tempo 8 hari lagi
          </Text>
          <Text variant="bodySm" color="rgba(90,74,32,0.75)" style={{ fontSize: 11.5, marginTop: 1 }}>
            25 Mei 2026 · saldo BCA cukup
          </Text>
        </View>
      </View>

      {/* CTAs */}
      <View style={{ marginHorizontal: 18, marginTop: 12, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: palette.inkFaint,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700' }}>
            🔔 Atur pengingat
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push('/(app)/tandai-bayar' as Href);
          }}
          style={{
            flex: 1.4,
            height: 52,
            borderRadius: 26,
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}>
          <Icon name="check" size={14} color={palette.lime} />
          <Text variant="bodySm" color={palette.lime} style={{ fontSize: 13, fontWeight: '700' }}>
            Tandai sudah dibayar
          </Text>
        </Pressable>
      </View>

      {/* meta */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {META.map((r, i) => {
          const numeric = /\d/.test(r[1]);
          return (
            <View
              key={r[0]}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderBottomWidth: i < META.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12, fontWeight: '500' }}>
                {r[0]}
              </Text>
              <Text
                variant={numeric ? 'mono' : 'bodySm'}
                style={{ fontSize: 13, fontWeight: '600' }}>
                {r[1]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* history */}
      <View style={{ marginHorizontal: 18, marginTop: 20 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Riwayat pembayaran
        </Text>
        <View style={{ backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
          {HISTORY.map((h, i) => {
            const paid = h.status === 'paid';
            const c = paid ? palette.cool : palette.coral;
            const bg = paid ? palette.limeSoft : tint.peach;
            return (
              <View
                key={h.d}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < HISTORY.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {paid ? (
                    <Icon name="check" size={14} color={c} />
                  ) : (
                    <Text variant="bodySm" color={c} style={{ fontSize: 14, fontWeight: '800' }}>
                      !
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600', letterSpacing: -0.2 }}>
                    {h.d}
                  </Text>
                  <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                    {h.src}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="mono" style={{ fontSize: 12.5, fontWeight: '600' }}>
                    {rupiah(h.amt, { short: true })}
                  </Text>
                  <Text variant="bodySm" color={c} style={{ fontSize: 10, marginTop: 2, fontWeight: '700' }}>
                    {paid ? 'Lunas' : 'Telat'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* pause / delete */}
      <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 1px ${palette.inkFaint}`,
          }}>
          <Text variant="bodySm" style={{ fontSize: 12.5, fontWeight: '600' }}>
            Pause tagihan
          </Text>
        </Pressable>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 1px ${palette.inkFaint}`,
          }}>
          <Text variant="bodySm" color={palette.coral} style={{ fontSize: 12.5, fontWeight: '600' }}>
            Hapus
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
