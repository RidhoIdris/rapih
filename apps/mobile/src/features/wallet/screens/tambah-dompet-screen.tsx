import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Provider = { name: string; sub: string; c: string };

const BANKS: Provider[] = [
  { name: 'BCA', sub: 'Tahapan, Xpresi, Tabunganku', c: '#0060af' },
  { name: 'Mandiri', sub: 'Tabungan & Giro', c: '#003e7e' },
  { name: 'BNI', sub: 'Taplus, BNI Emerald', c: '#ee7300' },
  { name: 'BRI', sub: 'BritAma, Simpedes', c: '#003a78' },
  { name: 'CIMB', sub: 'OCTO Savers', c: '#7b2730' },
  { name: 'Permata', sub: 'PermataMe', c: '#4a8b3e' },
];
const EWALLETS: Provider[] = [
  { name: 'GoPay', sub: 'Saldo & PayLater', c: '#00a2e0' },
  { name: 'OVO', sub: 'Saldo & Points', c: '#4a288e' },
  { name: 'ShopeePay', sub: 'Saldo & Coin', c: '#ee4d2d' },
  { name: 'DANA', sub: 'Saldo', c: '#118eea' },
  { name: 'LinkAja', sub: 'Saldo & Syariah', c: '#e6231f' },
];

function Row({ b, last, onPress }: { b: Provider; last: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.inkFaint,
      }}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: b.c,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="bodySm" color="#fff" style={{ fontSize: 12, fontWeight: '700', letterSpacing: -0.3 }}>
          {b.name.slice(0, 2)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
          {b.name}
        </Text>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
          {b.sub}
        </Text>
      </View>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 28,
          backgroundColor: palette.sand,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="plus" size={14} color={palette.ink} />
      </View>
    </Pressable>
  );
}

function SectionCard({ items, onPick }: { items: Provider[]; onPick: () => void }) {
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: 22,
        borderCurve: 'continuous',
      }}>
      {items.map((b, i) => (
        <Row key={b.name} b={b} last={i === items.length - 1} onPress={onPick} />
      ))}
    </View>
  );
}

export function TambahDompetScreen() {
  const router = useRouter();
  const pick = () => {
    haptics.select();
    router.push('/(app)/tambah-dompet-detail' as Href);
  };

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
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Tambah Dompet
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* hero */}
      <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700' }}>
          Pilih jenis
        </Text>
        <Text
          variant="displayS"
          style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32, marginTop: 6 }}>
          Mau tambah dompet{'\n'}seperti apa?
        </Text>
        <Text
          variant="body"
          color={palette.inkSoft}
          style={{ fontSize: 12.5, lineHeight: 19, marginTop: 8 }}>
          Catat manual aja dulu. Saat ini kamu masih input transaksi sendiri —
          biar tetap pribadi.
        </Text>
      </View>

      {/* quick: cash + custom */}
      <View style={{ marginHorizontal: 18, marginTop: 22, flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={pick}
          style={{
            flex: 1,
            padding: 16,
            paddingVertical: 16,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            gap: 8,
          }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(184,232,194,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 18 }}>💵</Text>
          </View>
          <View>
            <Text variant="bodySm" color={ONDARK} style={{ fontSize: 13.5, fontWeight: '700' }}>
              Tunai
            </Text>
            <Text
              variant="bodySm"
              color="rgba(240,240,232,0.65)"
              style={{ fontSize: 11, marginTop: 1 }}>
              Cash di dompet, celengan
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={pick}
          style={{
            flex: 1,
            padding: 16,
            paddingVertical: 16,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            gap: 8,
          }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: palette.limeSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 18 }}>🏷️</Text>
          </View>
          <View>
            <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '700' }}>
              Custom
            </Text>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
              Beri nama sendiri
            </Text>
          </View>
        </Pressable>
      </View>

      {/* bank section */}
      <View style={{ marginHorizontal: 18, marginTop: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            paddingBottom: 8,
          }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700' }}>
            Rekening Bank
          </Text>
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 9,
              borderRadius: 999,
              backgroundColor: palette.limeSoft,
            }}>
            <Text
              variant="chip"
              color={palette.moss}
              style={{ fontSize: 9.5, letterSpacing: 0.5, fontWeight: '700' }}>
              Manual · MVP
            </Text>
          </View>
        </View>
        <SectionCard items={BANKS} onPick={pick} />
      </View>

      {/* e-wallet section */}
      <View style={{ marginHorizontal: 18, marginTop: 18 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700', paddingHorizontal: 4, paddingBottom: 8 }}>
          E-Wallet
        </Text>
        <SectionCard items={EWALLETS} onPick={pick} />
      </View>

      {/* search hint */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Icon name="search" size={16} color={palette.inkMute} />
        <Text variant="bodySm" color={palette.inkMute} style={{ flex: 1, fontSize: 12.5 }}>
          Cari bank atau dompet lainnya…
        </Text>
      </View>
    </Screen>
  );
}
