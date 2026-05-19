import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

type Account = { name: string; sub: string; amt: number; brand: string };

const BANKS: Account[] = [
  { name: 'BCA', sub: 'Tahapan ····432', amt: 8420000, brand: '#0060af' },
  { name: 'Mandiri', sub: 'Tabungan ····187', amt: 2840000, brand: '#003e7e' },
  { name: 'BNI', sub: 'Taplus ····902', amt: 1250000, brand: '#ee7300' },
];
const EWALLETS: Account[] = [
  { name: 'GoPay', sub: 'Saldo utama', amt: 540000, brand: '#00a2e0' },
  { name: 'OVO', sub: 'Saldo', amt: 218000, brand: '#4a288e' },
  { name: 'ShopeePay', sub: 'Coin Rp 12rb', amt: 86000, brand: '#ee4d2d' },
];
const OTHERS: Account[] = [
  { name: 'Tunai', sub: 'Manual', amt: 320000, brand: '#5a8a6a' },
  { name: 'Bibit', sub: 'Reksadana · investasi', amt: 11420000, brand: '#16c8b6' },
];

function Section({
  title,
  items,
  onRow,
}: {
  title: string;
  items: Account[];
  onRow: () => void;
}) {
  return (
    <View style={{ marginHorizontal: 18, marginTop: 18 }}>
      <Text
        variant="label"
        color={palette.inkMute}
        style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
          padding: 4,
        }}>
        {items.map((b, i) => (
          <Pressable
            key={b.name}
            onPress={onRow}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderBottomWidth: i < items.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: b.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                variant="bodySm"
                color="#fff"
                style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.3 }}>
                {b.name.slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
                {b.name}
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 2 }}>
                {b.sub}
              </Text>
            </View>
            <Text variant="mono" style={{ fontSize: 13.5, fontWeight: '500' }}>
              {rupiah(b.amt, { short: true })}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function DompetScreen() {
  const router = useRouter();
  const goAdd = () => router.push('/(app)/tambah-dompet' as Href);
  const goDetail = () => router.push('/(app)/dompet-detail' as Href);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={96}>
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
          }}>
          <View>
            <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11 }}>
              8 dompet terhubung
            </Text>
            <Text variant="displayL" style={{ fontSize: 38, letterSpacing: -1.6, lineHeight: 40, marginTop: 4 }}>
              Dompet
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.tap();
              goAdd();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 40,
              backgroundColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="plus" size={14} color={palette.lime} />
          </Pressable>
        </View>

        {/* hero total */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 22,
            paddingVertical: 18,
            paddingHorizontal: 20,
            borderRadius: 24,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            overflow: 'hidden',
          }}>
          <Glow
            size={160}
            color={palette.lime}
            opacity={0.18}
            fadeAt={0.7}
            position={{ top: -50, right: -40 }}
          />
          <Text
            variant="eyebrow"
            color={palette.lime}
            style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
            Total saldo
          </Text>
          <Text
            variant="figureXL"
            color={ONDARK}
            style={{ fontSize: 42, letterSpacing: -1.8, lineHeight: 44, marginTop: 6 }}>
            Rp 25.094.000
          </Text>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
            {[
              { l: 'Tunai & bank', v: 'Rp 13,1jt' },
              { l: 'E-wallet', v: 'Rp 844rb' },
              { l: 'Investasi', v: 'Rp 11,4jt' },
            ].map((s, i) => (
              <View key={s.l} style={{ flexDirection: 'row', gap: 14 }}>
                {i > 0 && (
                  <View style={{ width: 1, backgroundColor: 'rgba(240,240,232,0.15)' }} />
                )}
                <View>
                  <Text
                    variant="label"
                    color="rgba(240,240,232,0.55)"
                    style={{ fontSize: 10, letterSpacing: 0.8, fontWeight: '600' }}>
                    {s.l}
                  </Text>
                  <Text variant="mono" color={ONDARK} style={{ fontSize: 13, marginTop: 3 }}>
                    {s.v}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Section title="Rekening Bank" items={BANKS} onRow={goDetail} />
        <Section title="E-Wallet" items={EWALLETS} onRow={goDetail} />
        <Section title="Lainnya" items={OTHERS} onRow={goDetail} />

        <Pressable
          onPress={() => {
            haptics.tap();
            goAdd();
          }}
          style={{
            marginHorizontal: 18,
            marginTop: 20,
            height: 56,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: palette.inkFaint,
            borderStyle: 'dashed',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <Icon name="plus" size={14} color={palette.inkSoft} />
          <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 13, fontWeight: '500' }}>
            Hubungkan dompet baru
          </Text>
        </Pressable>
      </Screen>

      <TabBar
        active="beranda"
        onTab={(id) => {
          if (id === 'tanya') router.push('/(app)/tanya' as Href);
          if (id === 'beranda') router.push('/(app)/beranda' as Href);
        }}
      />
    </View>
  );
}
