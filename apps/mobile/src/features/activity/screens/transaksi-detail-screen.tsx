import { transactionKindLabel, type TransactionDto } from '@rapih/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons/icon';
import { Screen, Text } from '@/components/ui';
import { getTransaction } from '@/features/activity/api';
import { useTransactionStore } from '@/features/activity/transaction-store';
import { fullDateLabel, signedAmount } from '@/features/activity/display';
import { useCategoryStore } from '@/features/category/category-store';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';

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
  const { id } = useLocalSearchParams<{ id?: string }>();

  const fromStore = useTransactionStore((s) => (id ? s.items.find((t) => t.id === id) : undefined));
  const remove = useTransactionStore((s) => s.remove);
  const categories = useCategoryStore((s) => s.items);
  const fetchCategories = useCategoryStore((s) => s.fetch);
  const wallets = useWalletStore((s) => s.wallets);
  const fetchWallets = useWalletStore((s) => s.fetch);

  const [fetched, setFetched] = useState<TransactionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const tx = fromStore ?? fetched;

  // Deep-link fallback: fetch the single transaction if it isn't in the store.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on id only
  useEffect(() => {
    if (categories.length === 0) void fetchCategories();
    if (wallets.length === 0) void fetchWallets();
    if (id && !fromStore) {
      getTransaction(id)
        .then(setFetched)
        .catch(() => setFetched(null));
    }
  }, [id]);

  const category = useMemo(
    () => (tx?.category_id ? categories.find((c) => c.id === tx.category_id) : undefined),
    [tx?.category_id, categories],
  );
  const wallet = useMemo(
    () => (tx ? wallets.find((w) => w.id === tx.wallet_id) : undefined),
    [tx, wallets],
  );
  const toWallet = useMemo(
    () => (tx?.to_wallet_id ? wallets.find((w) => w.id === tx.to_wallet_id) : undefined),
    [tx?.to_wallet_id, wallets],
  );

  const onDelete = () => {
    if (!tx) return;
    Alert.alert('Hapus transaksi?', 'Transaksi ini akan dihapus permanen.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            await remove(tx.id);
            haptics.success();
            router.back();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus transaksi.';
            Alert.alert('Gagal', message);
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!tx) {
    return (
      <Screen background={palette.bg} bottomInset={28}>
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
          <View style={{ width: 38 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.moss} />
        </View>
      </Screen>
    );
  }

  const title = tx.note?.trim() || category?.name || transactionKindLabel[tx.kind];
  const heroColor = category?.color ?? palette.moss;
  const amt = signedAmount(tx);
  const badge = [transactionKindLabel[tx.kind], category?.name].filter(Boolean).join(' · ');

  const rows: [string, string][] = [
    ['Dompet', wallet?.provider_name ?? '—'],
    ...(toWallet ? ([['Ke dompet', toWallet.provider_name]] as [string, string][]) : []),
    ['Kategori', category?.name ?? 'Tanpa kategori'],
    ['Tanggal', fullDateLabel(tx.transacted_at)],
    ['Catatan', tx.note?.trim() || '—'],
  ];

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
        <HeaderBtn name="more" onPress={onDelete} />
      </View>

      {/* hero */}
      <View style={{ paddingHorizontal: 28, paddingTop: 32, alignItems: 'center' }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: heroColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" color="#fff" style={{ fontSize: 22, fontWeight: '700' }}>
            {title.trim()[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text
          variant="figureS"
          numberOfLines={2}
          style={{ fontSize: 22, letterSpacing: -0.5, marginTop: 12, textAlign: 'center' }}>
          {title}
        </Text>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11.5, marginTop: 4 }}>
          {fullDateLabel(tx.transacted_at)}
        </Text>
        <Text
          variant="figureXL"
          color={amt > 0 ? palette.cool : palette.ink}
          style={{ fontSize: 54, letterSpacing: -2.4, lineHeight: 56, marginTop: 18 }}>
          {rupiah(amt)}
        </Text>
        <View
          style={{
            marginTop: 12,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: palette.sand,
          }}>
          <Text variant="chip" color={palette.ink} style={{ fontSize: 12, fontWeight: '600' }}>
            {badge}
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
        {rows.map((r, i) => (
          <View
            key={r[0]}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 16,
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ fontSize: 12, fontWeight: '500' }}>
              {r[0]}
            </Text>
            <Text
              variant="bodySm"
              style={{ flex: 1, fontSize: 13, fontWeight: '500', textAlign: 'right' }}>
              {r[1]}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 24 }} />

      {/* delete */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={onDelete}
          disabled={busy}
          style={{
            height: 54,
            borderRadius: 27,
            borderWidth: 1.5,
            borderColor: palette.coral,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.5 : 1,
          }}>
          <Text variant="button" color={palette.coral} style={{ fontSize: 15 }}>
            {busy ? 'Menghapus…' : 'Hapus transaksi'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
