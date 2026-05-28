import { BackButton, Button, Screen, Text } from '@/components/ui';
import { useCategoryStore } from '@/features/category/category-store';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';
import type { ConsumeBody } from '@rapih/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, TextInput, View } from 'react-native';
import { allocateProportional } from '../allocation';
import { AllocationSummary } from '../components/allocation-summary';
import { type EditableReceiptItem, LineItemRow } from '../components/line-item-row';
import { useReceiptStore } from '../receipt-store';

export function ReceiptReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { consume, current, loadScan, remove } = useReceiptStore();
  const wallets = useWalletStore((state) => state.wallets);
  const fetchWallets = useWalletStore((state) => state.fetch);
  const categories = useCategoryStore((state) => state.items.filter((c) => c.kind === 'expense'));
  const fetchCategories = useCategoryStore((state) => state.fetch);
  const [mode, setMode] = useState<'per_item' | 'total'>('per_item');
  const [items, setItems] = useState<EditableReceiptItem[]>([]);

  useEffect(() => {
    if (id) void loadScan(id);
    void fetchWallets();
    void fetchCategories();
  }, [fetchCategories, fetchWallets, id, loadScan]);

  const scan = current?.scan;
  const ocr = scan?.ocr_result;
  const walletId = wallets[0]?.id;
  const categoryId = categories[0]?.id;

  useEffect(() => {
    if (!ocr || items.length > 0 || !categoryId) return;
    setItems(
      ocr.items.map((item) => ({
        ...item,
        amount: item.subtotal,
        categoryId,
      }))
    );
  }, [categoryId, items.length, ocr]);

  const allocated = useMemo(
    () => allocateProportional(items, ocr?.total ?? 0),
    [items, ocr?.total]
  );

  async function onSave() {
    if (!scan || !ocr || !walletId || !categoryId) {
      Alert.alert('Lengkapi dompet dan kategori dulu.');
      return;
    }
    const transactedAt = ocr.transacted_at
      ? new Date(`${ocr.transacted_at}T00:00:00`).toISOString()
      : new Date(scan.created_at).toISOString();
    const body: ConsumeBody =
      mode === 'per_item'
        ? {
            mode: 'per_item',
            wallet_id: walletId,
            items: items.map((item, idx) => ({
              name: item.name,
              amount: String(allocated[idx] ?? item.subtotal),
              category_id: item.categoryId || categoryId,
              transacted_at: transactedAt,
              note: item.name,
            })),
          }
        : {
            mode: 'total',
            wallet_id: walletId,
            category_id: categoryId,
            amount: String(ocr.total),
            transacted_at: transactedAt,
            merchant: ocr.merchant ?? undefined,
            note: ocr.merchant ?? 'Struk',
          };
    const ids = await consume(scan.id, body);
    Alert.alert(`${ids.length} transaksi disimpan.`);
    router.back();
  }

  async function onDelete() {
    if (!scan) return;
    await remove(scan.id);
    router.back();
  }

  return (
    <Screen background={palette.bg} bottomInset={28}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 12 }}>
        <BackButton />
        <Text variant="figureS" style={{ fontSize: 22 }}>
          Review struk
        </Text>
      </View>
      <View style={{ padding: 22, gap: 14 }}>
        {current?.image_url ? (
          <Image source={{ uri: current.image_url }} style={{ height: 180, borderRadius: 18 }} />
        ) : null}
        {!scan ? <Text variant="bodySm">Memuat...</Text> : null}
        {scan?.status === 'failed' ? (
          <View style={{ gap: 12 }}>
            <Text variant="figureS" style={{ fontSize: 20 }}>
              Struk gagal dibaca
            </Text>
            <Text variant="bodySm" color={palette.inkSoft}>
              {scan.failed_reason ?? 'Coba foto ulang atau pilih dari galeri.'}
            </Text>
            <Button label="Hapus" onPress={onDelete} />
          </View>
        ) : null}
        {scan && ocr ? (
          <View style={{ gap: 12 }}>
            <Text variant="figureS" style={{ fontSize: 22 }}>
              {ocr.merchant ?? 'Struk'} · {rupiah(ocr.total)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Per item" onPress={() => setMode('per_item')} fullWidth />
              <Button label="Total" onPress={() => setMode('total')} variant="social" fullWidth />
            </View>
            {mode === 'per_item' ? (
              <View style={{ backgroundColor: palette.card, borderRadius: 18, paddingHorizontal: 14 }}>
                {items.map((item, idx) => (
                  <LineItemRow
                    key={`${item.name}-${idx}`}
                    item={item}
                    allocated={allocated[idx] ?? item.subtotal}
                    onNameChange={(name) =>
                      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, name } : it)))
                    }
                  />
                ))}
              </View>
            ) : (
              <TextInput
                value={String(ocr.total)}
                editable={false}
                style={{
                  backgroundColor: palette.card,
                  borderRadius: 18,
                  color: palette.ink,
                  fontSize: 18,
                  fontWeight: '700',
                  padding: 14,
                }}
              />
            )}
            <AllocationSummary allocated={allocated} total={ocr.total} />
            <Button
              label={mode === 'per_item' ? `${items.length} transaksi simpan` : 'Simpan total'}
              onPress={onSave}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
