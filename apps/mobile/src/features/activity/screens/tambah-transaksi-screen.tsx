import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const CATS = [
  { name: 'Kebutuhan', c: tint.mint, txt: tint.mintInk },
  { name: 'Senang', c: tint.amber, txt: tint.amberInk },
  { name: 'Transport', c: tint.peach, txt: tint.peachInk },
  { name: 'Tabungan', c: palette.lime, txt: palette.moss },
  { name: 'Hadiah', c: tint.rose, txt: tint.roseInk },
  { name: 'Lainnya', c: palette.sand, txt: palette.ink },
];

const META: [string, string, string][] = [
  ['🏦', 'Dari dompet', 'BCA · ····432'],
  ['📅', 'Tanggal', 'Hari ini · 17 Mei'],
  ['✎', 'Catatan', 'Bayar makan tim'],
];

export function TambahTransaksiScreen() {
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
          <Icon name="x" size={12} color={palette.ink} />
        </Pressable>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            backgroundColor: palette.card,
            borderRadius: 999,
            padding: 4,
          }}>
          {['Keluar', 'Masuk', 'Transfer'].map((t, i) => (
            <Pressable
              key={t}
              onPress={() => haptics.select()}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: i === 0 ? palette.moss : 'transparent',
              }}>
              <Text
                variant="chip"
                color={i === 0 ? ONDARK : palette.inkSoft}
                style={{ fontSize: 11.5, fontWeight: '700' }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* amount */}
      <View style={{ paddingHorizontal: 28, paddingTop: 60, alignItems: 'center' }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
          Jumlah
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text variant="figureXL" color={palette.inkSoft} style={{ fontSize: 32, marginRight: 6 }}>
            Rp
          </Text>
          <Text variant="figureXL" style={{ fontSize: 64, letterSpacing: -3, lineHeight: 64 }}>
            145.000
          </Text>
          <View
            style={{ width: 2, height: 50, backgroundColor: palette.ink, marginLeft: 4 }}
          />
        </View>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12, marginTop: 8 }}>
          seratus empat puluh lima ribu rupiah
        </Text>
      </View>

      {/* category */}
      <View style={{ marginHorizontal: 18, marginTop: 32 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 10 }}>
          Kategori
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATS.map((c, i) => (
            <Pressable
              key={c.name}
              onPress={() => haptics.select()}
              style={{
                width: '31.6%',
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: c.c,
                alignItems: 'center',
                boxShadow: i === 1 ? `0 0 0 2px ${palette.ink}` : undefined,
              }}>
              <Text variant="bodySm" color={c.txt} style={{ fontSize: 12.5, fontWeight: '600' }}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* meta rows */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
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
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '500' }}>
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
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
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
            Simpan transaksi
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
