import type { RecurringDto } from '@rapih/shared';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons/icon';
import { Glow, Screen, Text } from '@/components/ui';
import { getRecurring } from '@/features/recurring/api';
import { useRecurringStore } from '@/features/recurring/recurring-store';
import {
  currentInstallment,
  daysUntil,
  fmtDate,
  installmentProgress,
  isInstallment,
  periodLabel,
  periodSuffix,
  projectedPayoffISO,
  remainingCount,
} from '@/features/recurring/display';
import { useCategoryStore } from '@/features/category/category-store';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';

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

export function RecurringDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const fromStore = useRecurringStore((s) => (id ? s.recurring.find((r) => r.id === id) : undefined));
  const remove = useRecurringStore((s) => s.remove);
  const wallets = useWalletStore((s) => s.wallets);
  const fetchWallets = useWalletStore((s) => s.fetch);
  const categories = useCategoryStore((s) => s.items);
  const fetchCategories = useCategoryStore((s) => s.fetch);

  const [fetched, setFetched] = useState<RecurringDto | null>(null);
  const [busy, setBusy] = useState(false);
  const bill = fromStore ?? fetched;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on id only
  useEffect(() => {
    if (wallets.length === 0) void fetchWallets();
    if (categories.length === 0) void fetchCategories();
    if (id && !fromStore) {
      getRecurring(id).then(setFetched).catch(() => setFetched(null));
    }
  }, [id]);

  const wallet = useMemo(() => (bill ? wallets.find((w) => w.id === bill.wallet_id) : undefined), [bill, wallets]);
  const category = useMemo(
    () => (bill?.category_id ? categories.find((c) => c.id === bill.category_id) : undefined),
    [bill?.category_id, categories],
  );

  const onDelete = () => {
    if (!bill) return;
    Alert.alert('Hapus tagihan?', `"${bill.name}" akan dihapus.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await remove(bill.id);
            haptics.success();
            router.back();
          } catch (err) {
            Alert.alert('Gagal', err instanceof Error ? err.message : 'Gagal menghapus tagihan.');
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!bill) {
    return (
      <Screen background={palette.bg} bottomInset={28}>
        <View style={{ paddingHorizontal: 22 }}>
          <HeaderBtn name="chevronLeft" onPress={() => { haptics.tap(); router.back(); }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.moss} />
        </View>
      </Screen>
    );
  }

  const d = daysUntil(bill.next_due_date);
  const dueLabel = d < 0 ? `Telat ${Math.abs(d)} hari` : d === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${d} hari lagi`;

  const installment = isInstallment(bill);
  const payoff = projectedPayoffISO(bill);

  const rows: [string, string][] = [
    ['Dompet', wallet?.provider_name ?? '—'],
    ['Kategori', category?.name ?? 'Tanpa kategori'],
    ['Periode', periodLabel[bill.period]],
    ...(installment
      ? ([
          ['Cicilan', `ke-${currentInstallment(bill)} dari ${bill.total_occurrences}`],
          ['Sisa', `${remainingCount(bill)} angsuran`],
          ['Proyeksi lunas', payoff ? fmtDate(payoff) : '—'],
        ] as [string, string][])
      : []),
    ['Jatuh tempo berikutnya', bill.is_complete ? 'Lunas' : fmtDate(bill.next_due_date)],
    ['Terakhir dibayar', bill.last_paid_at ? fmtDate(bill.last_paid_at) : '—'],
    ['Catatan', bill.note?.trim() || '—'],
  ];

  return (
    <Screen background={palette.bg} bottomInset={28}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 }}>
        <HeaderBtn name="chevronLeft" onPress={() => { haptics.tap(); router.back(); }} />
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          Detail Tagihan
        </Text>
        <HeaderBtn name="more" onPress={onDelete} />
      </View>

      {/* hero */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 20,
          padding: 22,
          borderRadius: 26,
          borderCurve: 'continuous',
          backgroundColor: palette.moss,
          overflow: 'hidden',
          boxShadow: '0 12px 28px rgba(31,42,31,0.28)',
        }}>
        <Glow size={180} color={palette.lime} opacity={0.2} fadeAt={0.7} position={{ top: -40, right: -40 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(184,232,194,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 24 }}>{bill.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={palette.lime} style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
              {wallet?.provider_name ?? 'Tagihan rutin'}
            </Text>
            <Text variant="figureS" color={palette.onDark} style={{ fontSize: 22, letterSpacing: -0.6, lineHeight: 24, marginTop: 4 }}>
              {bill.name}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text variant="figureXL" color={palette.onDark} style={{ fontSize: 44, letterSpacing: -1.8, lineHeight: 46 }}>
            {rupiah(Number(bill.amount), { short: true })}
          </Text>
          <Text variant="bodySm" color="rgba(240,240,232,0.7)" style={{ fontSize: 11.5 }}>
            {periodSuffix[bill.period]}
          </Text>
        </View>

        {installment && (
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text variant="bodySm" color="rgba(240,240,232,0.75)" style={{ fontSize: 10.5, fontWeight: '600' }}>
                Cicilan ke-{currentInstallment(bill)} dari {bill.total_occurrences}
              </Text>
              <Text variant="mono" color="rgba(240,240,232,0.75)" style={{ fontSize: 10.5 }}>
                {bill.is_complete ? 'Lunas' : `sisa ${remainingCount(bill)}`}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${Math.round(installmentProgress(bill) * 100)}%`, backgroundColor: palette.lime, borderRadius: 8 }} />
            </View>
          </View>
        )}
      </View>

      {/* upcoming alert */}
      {!bill.is_complete && (
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 12,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: d < 0 ? tint.peach : tint.amber,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: d < 0 ? palette.coral : tint.goldInk, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>⏰</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={d < 0 ? tint.peachInk : tint.amberInk} style={{ fontSize: 13.5, fontWeight: '700', letterSpacing: -0.2 }}>
            {dueLabel}
          </Text>
          <Text variant="bodySm" color={d < 0 ? 'rgba(138,68,56,0.75)' : 'rgba(90,74,32,0.75)'} style={{ fontSize: 11.5, marginTop: 1 }}>
            {fmtDate(bill.next_due_date)}
          </Text>
        </View>
      </View>
      )}

      {/* CTAs */}
      <View style={{ marginHorizontal: 18, marginTop: 12, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onDelete}
          disabled={busy}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 26,
            borderWidth: 1.5,
            borderColor: palette.coral,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.5 : 1,
          }}>
          <Text variant="bodySm" color={palette.coral} style={{ fontSize: 13, fontWeight: '700' }}>
            Hapus
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (bill.is_complete) return;
            haptics.tap();
            router.push(`/(app)/tandai-bayar?id=${encodeURIComponent(bill.id)}` as Href);
          }}
          disabled={bill.is_complete}
          style={{
            flex: 1.6,
            height: 52,
            borderRadius: 26,
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: bill.is_complete ? 0.4 : 1,
          }}>
          <Icon name="check" size={14} color={palette.lime} />
          <Text variant="bodySm" color={palette.lime} style={{ fontSize: 13, fontWeight: '700' }}>
            {bill.is_complete ? 'Lunas' : 'Tandai sudah dibayar'}
          </Text>
        </Pressable>
      </View>

      {/* meta */}
      <View style={{ marginHorizontal: 18, marginTop: 18, backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
        {rows.map((r, i) => {
          const numeric = /\d/.test(r[1]);
          return (
            <View
              key={r[0]}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 16,
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                borderBottomColor: palette.inkFaint,
              }}>
              <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12, fontWeight: '500' }}>
                {r[0]}
              </Text>
              <Text variant={numeric ? 'mono' : 'bodySm'} style={{ flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                {r[1]}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
