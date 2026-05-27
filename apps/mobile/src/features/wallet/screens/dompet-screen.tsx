import type { WalletDto, WalletKind } from '@rapih/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { brandColor, brandInitials } from '@/features/wallet/brands';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

const SECTIONS: { kind: WalletKind | 'group_savings'; title: string; kinds: WalletKind[] }[] = [
  { kind: 'bank', title: 'Rekening Bank', kinds: ['bank'] },
  { kind: 'ewallet', title: 'E-Wallet', kinds: ['ewallet'] },
  { kind: 'group_savings', title: 'Lainnya', kinds: ['cash', 'investment', 'other'] },
];

function balanceNumber(w: WalletDto): number {
  // Mobile UI uses Number for display. Wallets won't realistically exceed Number.MAX_SAFE_INTEGER cents.
  return Number(w.balance);
}

function Row({ wallet, onPress }: { wallet: WalletDto; onPress: () => void }) {
  const color = brandColor(wallet.kind, wallet.provider_name);
  const subtitle =
    wallet.label ?? wallet.provider_name; // label kosong → fallback ke provider_name (kosong-like)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text
          variant="bodySm"
          color="#fff"
          style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.3 }}>
          {brandInitials(wallet.provider_name)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="bodySm"
          style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
          {wallet.provider_name}
        </Text>
        {wallet.label ? (
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text variant="mono" style={{ fontSize: 13.5, fontWeight: '500' }}>
        {rupiah(balanceNumber(wallet), { short: true })}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  wallets,
  onRow,
}: {
  title: string;
  wallets: WalletDto[];
  onRow: (id: string) => void;
}) {
  if (wallets.length === 0) return null;
  return (
    <View style={{ marginHorizontal: 18, marginTop: 18 }}>
      <Text
        variant="label"
        color={palette.inkMute}
        style={{
          fontSize: 10.5,
          letterSpacing: 1.4,
          fontWeight: '700',
          paddingHorizontal: 4,
          paddingBottom: 8,
        }}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
          padding: 4,
        }}>
        {wallets.map((w, i) => (
          <View
            key={w.id}
            style={{
              borderBottomWidth: i < wallets.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Row wallet={w} onPress={() => onRow(w.id)} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function DompetScreen() {
  const router = useRouter();
  const { status, wallets, fetch } = useWalletStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    void fetch();
  }, []);

  const totalCents = useMemo(
    () => wallets.reduce((acc, w) => acc + balanceNumber(w), 0),
    [wallets],
  );

  const sections = useMemo(() => {
    return SECTIONS.map(({ title, kinds }) => ({
      title,
      wallets: wallets.filter((w) => kinds.includes(w.kind)),
    }));
  }, [wallets]);

  const grouped = useMemo(() => {
    const sum = (kinds: WalletKind[]) =>
      wallets.filter((w) => kinds.includes(w.kind)).reduce((a, w) => a + balanceNumber(w), 0);
    return {
      bankCash: sum(['bank', 'cash']),
      ewallet: sum(['ewallet']),
      investment: sum(['investment']),
    };
  }, [wallets]);

  const goAdd = () => router.push('/(app)/tambah-dompet' as Href);
  const goDetail = (id: string) =>
    router.push(`/(app)/dompet-detail?id=${encodeURIComponent(id)}` as Href);

  const isLoading = status === 'loading' && wallets.length === 0;
  const isEmpty = status === 'ready' && wallets.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl refreshing={status === 'loading'} onRefresh={() => void fetch()} />
        }>
        <Screen background={palette.bg} bottomInset={0}>
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
                {wallets.length} dompet terhubung
              </Text>
              <Text
                variant="displayL"
                style={{ fontSize: 38, letterSpacing: -1.6, lineHeight: 40, marginTop: 4 }}>
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
              {rupiah(totalCents)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
              {[
                { l: 'Tunai & bank', v: rupiah(grouped.bankCash, { short: true }) },
                { l: 'E-wallet', v: rupiah(grouped.ewallet, { short: true }) },
                { l: 'Investasi', v: rupiah(grouped.investment, { short: true }) },
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

          {isLoading ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text variant="bodySm" color={palette.inkMute}>
                Memuat dompet…
              </Text>
            </View>
          ) : isEmpty ? (
            <View style={{ marginHorizontal: 18, marginTop: 32, alignItems: 'center' }}>
              <Text variant="bodySm" color={palette.inkSoft} style={{ textAlign: 'center' }}>
                Belum ada dompet. Yuk tambah dompet pertama.
              </Text>
            </View>
          ) : (
            <>
              {sections.map((s) => (
                <Section key={s.title} title={s.title} wallets={s.wallets} onRow={goDetail} />
              ))}
            </>
          )}

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
            <Text
              variant="bodySm"
              color={palette.inkSoft}
              style={{ fontSize: 13, fontWeight: '500' }}>
              Hubungkan dompet baru
            </Text>
          </Pressable>
        </Screen>
      </ScrollView>

      <TabBar active="beranda" />
    </View>
  );
}
