import type { CreateTransactionBody, TransactionKind, WalletDto } from '@rapih/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Screen, Text } from '@/components/ui';
import { useTransactionStore } from '@/features/activity/transaction-store';
import { useCategoryStore } from '@/features/category/category-store';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { dayHeader } from '@/features/activity/display';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

function parseDigits(s: string): number {
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}

const KINDS: { id: TransactionKind; label: string }[] = [
  { id: 'expense', label: 'Keluar' },
  { id: 'income', label: 'Masuk' },
  { id: 'transfer', label: 'Transfer' },
];

function WalletChip({
  wallet,
  active,
  onPress,
}: {
  wallet: WalletDto;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? palette.moss : palette.card,
        boxShadow: active ? undefined : `0 0 0 1px ${palette.inkFaint}`,
      }}>
      <Text
        variant="chip"
        color={active ? ONDARK : palette.ink}
        style={{ fontSize: 12.5, fontWeight: '600' }}>
        {wallet.provider_name}
      </Text>
    </Pressable>
  );
}

function WalletPicker({
  label,
  wallets,
  selectedId,
  onSelect,
}: {
  label: string;
  wallets: WalletDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text
        variant="label"
        color={palette.inkMute}
        style={{
          fontSize: 11,
          letterSpacing: 1.4,
          fontWeight: '700',
          paddingHorizontal: 22,
          paddingBottom: 8,
        }}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 6 }}>
        {wallets.map((w) => (
          <WalletChip
            key={w.id}
            wallet={w}
            active={selectedId === w.id}
            onPress={() => {
              haptics.select();
              onSelect(w.id);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function TambahTransaksiScreen() {
  const router = useRouter();

  const create = useTransactionStore((s) => s.create);
  const categoryItems = useCategoryStore((s) => s.items);
  const fetchCategories = useCategoryStore((s) => s.fetch);
  const wallets = useWalletStore((s) => s.wallets);
  const fetchWallets = useWalletStore((s) => s.fetch);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [raw, setRaw] = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const amount = parseDigits(raw);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    if (categoryItems.length === 0) void fetchCategories();
    if (wallets.length === 0) void fetchWallets();
  }, []);

  // Default the source wallet to the first one once loaded.
  useEffect(() => {
    if (!walletId && wallets.length > 0) setWalletId(wallets[0].id);
  }, [wallets, walletId]);

  const categories = useMemo(
    () => categoryItems.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense')),
    [categoryItems, kind],
  );

  const onSave = async () => {
    if (busy) return;
    if (amount <= 0) {
      Alert.alert('Jumlah belum diisi', 'Masukkan nominal transaksi dulu ya.');
      return;
    }
    if (!walletId) {
      Alert.alert('Pilih dompet', 'Pilih dompet sumber dulu.');
      return;
    }
    if (kind === 'transfer') {
      if (!toWalletId) {
        Alert.alert('Pilih dompet tujuan', 'Transfer butuh dompet tujuan.');
        return;
      }
      if (toWalletId === walletId) {
        Alert.alert('Dompet sama', 'Dompet tujuan tidak boleh sama dengan sumber.');
        return;
      }
    }

    const body: CreateTransactionBody = {
      kind,
      wallet_id: walletId,
      amount: String(amount),
      transacted_at: new Date().toISOString(),
      note: note.trim() || null,
      ...(kind === 'transfer'
        ? { to_wallet_id: toWalletId ?? undefined }
        : { category_id: categoryId ?? null }),
    };

    setBusy(true);
    try {
      await create(body);
      haptics.success();
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan transaksi.';
      Alert.alert('Gagal', message);
      setBusy(false);
    }
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
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            backgroundColor: palette.card,
            borderRadius: 999,
            padding: 4,
          }}>
          {KINDS.map((k) => {
            const on = kind === k.id;
            return (
              <Pressable
                key={k.id}
                onPress={() => {
                  haptics.select();
                  setKind(k.id);
                  setCategoryId(null);
                }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: on ? palette.moss : 'transparent',
                }}>
                <Text
                  variant="chip"
                  color={on ? ONDARK : palette.inkSoft}
                  style={{ fontSize: 11.5, fontWeight: '700' }}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* amount */}
      <View style={{ paddingHorizontal: 28, paddingTop: 48, alignItems: 'center' }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
          Jumlah
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
          }}>
          <Text variant="figureXL" color={palette.inkSoft} style={{ fontSize: 32, marginRight: 6 }}>
            Rp
          </Text>
          <TextInput
            value={raw ? amount.toLocaleString('id-ID') : ''}
            onChangeText={setRaw}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={palette.inkFaint}
            style={{
              fontFamily: 'Bricolage-500',
              fontSize: 56,
              letterSpacing: -3,
              color: palette.ink,
              padding: 0,
              minWidth: 80,
              textAlign: 'center',
            }}
          />
        </View>
      </View>

      {/* category — hidden for transfers */}
      {kind !== 'transfer' && (
        <View style={{ marginTop: 32 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{
              fontSize: 11,
              letterSpacing: 1.4,
              fontWeight: '700',
              paddingHorizontal: 22,
              paddingBottom: 10,
            }}>
            Kategori
          </Text>
          <View style={{ paddingHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((c) => {
              const on = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    haptics.select();
                    setCategoryId(on ? null : c.id);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: palette.card,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: on ? `0 0 0 2px ${palette.moss}` : `0 0 0 1px ${palette.inkFaint}`,
                  }}>
                  <View
                    style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color }}
                  />
                  <Text variant="bodySm" style={{ fontSize: 12.5, fontWeight: '600' }}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* source wallet */}
      <WalletPicker
        label={kind === 'transfer' ? 'Dari dompet' : 'Dompet'}
        wallets={wallets}
        selectedId={walletId}
        onSelect={setWalletId}
      />

      {/* destination wallet — transfers only */}
      {kind === 'transfer' && (
        <WalletPicker
          label="Ke dompet"
          wallets={wallets}
          selectedId={toWalletId}
          onSelect={setToWalletId}
        />
      )}

      {/* note */}
      <View style={{ paddingHorizontal: 18, marginTop: 16 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{
            fontSize: 11,
            letterSpacing: 1.4,
            fontWeight: '700',
            paddingHorizontal: 4,
            paddingBottom: 8,
          }}>
          Catatan (opsional)
        </Text>
        <View
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
          }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="mis. Bayar makan tim"
            placeholderTextColor={palette.inkMute}
            maxLength={500}
            style={{
              fontSize: 15,
              fontWeight: '500',
              letterSpacing: -0.2,
              color: palette.ink,
              padding: 0,
            }}
          />
        </View>
        <Text
          variant="bodySm"
          color={palette.inkMute}
          style={{ fontSize: 11, marginTop: 8, paddingHorizontal: 4 }}>
          Tanggal · {dayHeader(new Date().toISOString())}
        </Text>
      </View>

      <View style={{ flex: 1, minHeight: 16 }} />

      {/* CTA */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Pressable
          onPress={onSave}
          disabled={busy}
          style={{
            height: 54,
            borderRadius: 27,
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.5 : 1,
          }}>
          <Icon name="check" size={14} color={ONDARK} />
          <Text variant="button" color={ONDARK} style={{ fontSize: 15 }}>
            {busy ? 'Menyimpan…' : 'Simpan transaksi'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
