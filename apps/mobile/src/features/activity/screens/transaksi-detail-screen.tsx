import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { palette, tint } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const ROWS: [string, string][] = [
  ['Dompet', 'GoPay · ····8821'],
  ['Status', 'Selesai · diverifikasi'],
  ['Order ID', 'GF-238190-MX2'],
  ['Lokasi', 'Mie Gacoan, Bekasi'],
  ['Item', '2× Mie Gacoan Lv 3 + Es Teh'],
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

export function TransaksiDetailScreen() {
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
          Detail Transaksi
        </Text>
        <HeaderBtn name="more" onPress={() => haptics.tap()} />
      </View>

      {/* hero */}
      <View style={{ paddingHorizontal: 28, paddingTop: 32, alignItems: 'center' }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: tint.amber,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" color={tint.goldInk} style={{ fontSize: 22, fontWeight: '700' }}>
            G
          </Text>
        </View>
        <Text variant="figureS" style={{ fontSize: 22, letterSpacing: -0.5, marginTop: 12 }}>
          Gojek · GoFood
        </Text>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 4 }}>
          17 Mei 2026 · 09:14 WIB
        </Text>
        <Text variant="figureXL" style={{ fontSize: 54, letterSpacing: -2.4, lineHeight: 56, marginTop: 18 }}>
          −Rp 68.000
        </Text>
        <View
          style={{
            marginTop: 12,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: tint.amber,
          }}>
          <Text variant="chip" color={tint.amberInk} style={{ fontSize: 12, fontWeight: '600' }}>
            Senang-Senang · Makan luar
          </Text>
        </View>
      </View>

      {/* detail rows */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 28,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {ROWS.map((r, i) => (
          <View
            key={r[0]}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderBottomWidth: i < ROWS.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12, fontWeight: '500' }}>
              {r[0]}
            </Text>
            <Text
              variant="bodySm"
              style={{ fontSize: 13, fontWeight: '500', textAlign: 'right', maxWidth: 220 }}>
              {r[1]}
            </Text>
          </View>
        ))}
      </View>

      {/* notes & receipt */}
      <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 10 }}>
        {([
          { l: 'Tambah catatan', i: 'doc' as IconName },
          { l: 'Foto struk', i: 'image' as IconName },
        ]).map((b) => (
          <Pressable
            key={b.l}
            onPress={() => haptics.tap()}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: palette.card,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
            <Icon name={b.i} size={14} color={palette.ink} />
            <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600' }}>
              {b.l}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* AI insight */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 20,
          borderCurve: 'continuous',
          backgroundColor: palette.lime,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
        }}>
        <Icon name="sparkle" size={14} color={palette.moss} />
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
            Mie Gacoan 4× bulan ini.
          </Text>
          <Text variant="bodySm" color="rgba(28,36,24,0.65)" style={{ fontSize: 11.5, marginTop: 2 }}>
            Total Rp 272rb. Jadikan budget bulanan?
          </Text>
        </View>
      </View>

      <View style={{ marginHorizontal: 18, marginTop: 22, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: palette.inkFaint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" style={{ fontSize: 13, fontWeight: '600' }}>
            Ubah kategori
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.success();
            router.back();
          }}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 24,
            backgroundColor: palette.moss,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" color={ONDARK} style={{ fontSize: 13, fontWeight: '700' }}>
            Simpan
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
