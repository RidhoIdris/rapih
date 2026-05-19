import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const ITEMS = [
  { n: 'Indomie Goreng', q: '×2', a: 7000 },
  { n: 'Aqua 600ml', q: '×1', a: 4500 },
  { n: 'Sari Roti Coklat', q: '×1', a: 12000 },
  { n: 'Pocari Sweat', q: '×2', a: 17000 },
  { n: 'Telur Ayam 0,5kg', q: '×1', a: 14500 },
];
const TOTAL = ITEMS.reduce((s, r) => s + r.a, 0);

const META: [string, string, string][] = [
  ['🏦', 'Dari dompet', 'BCA · ····432'],
  ['🍚', 'Catat ke budget', 'Kebutuhan'],
];

export function ScanStrukReviewScreen() {
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
          Cek Hasil Scan
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* merchant + total */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 20,
          paddingVertical: 20,
          paddingHorizontal: 22,
          borderRadius: 26,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            borderCurve: 'continuous',
            backgroundColor: tint.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 16, fontWeight: '800' }}>
            IM
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="bodySm" style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }}>
              Indomaret Sudirman
            </Text>
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 7,
                borderRadius: 999,
                backgroundColor: palette.lime,
              }}>
              <Text variant="chip" color={palette.moss} style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 }}>
                92%
              </Text>
            </View>
          </View>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 2 }}>
            17 Mei 2026 · 19:14 · QRIS BCA
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="figureM" style={{ fontSize: 24, letterSpacing: -0.7 }}>
            {rupiah(-TOTAL)}
          </Text>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 1 }}>
            {ITEMS.length} item
          </Text>
        </View>
      </View>

      {/* AI banner */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: palette.limeSoft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="sparkle" size={14} color={palette.moss} />
        <Text variant="bodySm" color={palette.moss} style={{ flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>
          Rapih bantu rapikan: kategori otomatis ke{' '}
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 12, fontWeight: '800' }}>
            Kebutuhan
          </Text>
          . Ubah kalau perlu.
        </Text>
      </View>

      {/* items */}
      <View style={{ marginHorizontal: 18, marginTop: 14 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          Item terdeteksi
        </Text>
        <View
          style={{
            backgroundColor: palette.card,
            borderRadius: 22,
            borderCurve: 'continuous',
          }}>
          {ITEMS.map((r, i) => (
            <View
              key={r.n}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: i < ITEMS.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 24,
                  backgroundColor: palette.moss,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="check" size={12} color={palette.lime} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  variant="bodySm"
                  numberOfLines={1}
                  style={{ fontSize: 13.5, fontWeight: '500', letterSpacing: -0.2 }}>
                  {r.n}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text variant="mono" color={palette.inkMute} style={{ fontSize: 11 }}>
                    {r.q}
                  </Text>
                  <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>
                    ·
                  </Text>
                  <View
                    style={{
                      paddingVertical: 1,
                      paddingHorizontal: 7,
                      borderRadius: 999,
                      backgroundColor: palette.limeSoft,
                    }}>
                    <Text variant="chip" color={palette.moss} style={{ fontSize: 9.5, fontWeight: '700' }}>
                      Kebutuhan
                    </Text>
                  </View>
                </View>
              </View>
              <Text variant="mono" style={{ fontSize: 12.5, fontWeight: '600' }}>
                {rupiah(r.a)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* meta */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {META.map((r, i) => (
          <View
            key={r[1]}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: i < META.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Text style={{ fontSize: 16 }}>{r[0]}</Text>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ flex: 1, fontSize: 12, fontWeight: '500' }}>
              {r[1]}
            </Text>
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600' }}>
              {r[2]}
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 14 }}>
              ›
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 27,
            borderWidth: 1,
            borderColor: palette.inkFaint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700' }}>
            Foto ulang
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.success();
            router.push('/(app)/transaksi' as Href);
          }}
          style={{
            flex: 2,
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
            Simpan transaksi
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
