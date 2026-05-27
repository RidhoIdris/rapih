import type { WalletKind } from '@rapih/shared';
import { type Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Screen, Text } from '@/components/ui';
import { PROVIDERS, type WalletProvider } from '@/features/wallet/brands';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

function ProviderRow({
  p,
  last,
  onPress,
}: {
  p: WalletProvider;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.inkFaint,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: p.color,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text
          variant="bodySm"
          color="#fff"
          style={{ fontSize: 12, fontWeight: '700', letterSpacing: -0.3 }}>
          {p.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
          {p.name}
        </Text>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
          {p.sub}
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

function SectionCard({
  items,
  onPick,
}: {
  items: WalletProvider[];
  onPick: (p: WalletProvider) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: 22,
        borderCurve: 'continuous',
      }}>
      {items.map((p, i) => (
        <ProviderRow key={p.name} p={p} last={i === items.length - 1} onPress={() => onPick(p)} />
      ))}
    </View>
  );
}

export function TambahDompetScreen() {
  const router = useRouter();

  const pick = (kind: WalletKind, p: WalletProvider) => {
    haptics.select();
    const qs = new URLSearchParams({
      kind,
      provider_name: p.name,
      brand_color: p.color,
      sub: p.sub,
    }).toString();
    router.push(`/(app)/tambah-dompet-detail?${qs}` as Href);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
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
            Catat manual aja dulu. Saat ini kamu masih input transaksi sendiri — biar tetap pribadi.
          </Text>
        </View>

        {/* quick: cash + custom */}
        <View style={{ marginHorizontal: 18, marginTop: 22, flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => {
              const cashProvider = PROVIDERS.cash[0];
              if (cashProvider) pick('cash', cashProvider);
            }}
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
            onPress={() => {
              const otherProvider = PROVIDERS.other[0];
              if (otherProvider) pick('other', otherProvider);
            }}
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
                backgroundColor: palette.sand,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 18 }}>＋</Text>
            </View>
            <View>
              <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '700' }}>
                Lainnya
              </Text>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
                Custom dompet
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 22, marginTop: 26 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700', paddingBottom: 8 }}>
            BANK
          </Text>
        </View>
        <View style={{ marginHorizontal: 18 }}>
          <SectionCard
            items={[...PROVIDERS.bank]}
            onPick={(p) => pick('bank', p)}
          />
        </View>

        <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700', paddingBottom: 8 }}>
            E-WALLET
          </Text>
        </View>
        <View style={{ marginHorizontal: 18 }}>
          <SectionCard
            items={[...PROVIDERS.ewallet]}
            onPick={(p) => pick('ewallet', p)}
          />
        </View>

        <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700', paddingBottom: 8 }}>
            INVESTASI
          </Text>
        </View>
        <View style={{ marginHorizontal: 18 }}>
          <SectionCard
            items={[...PROVIDERS.investment]}
            onPick={(p) => pick('investment', p)}
          />
        </View>
      </Screen>
    </ScrollView>
  );
}
