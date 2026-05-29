import type { CategoryDto, TransactionDto, TransactionKind, WalletDto } from '@rapih/shared';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons/icon';
import { Screen, TabBar, Text } from '@/components/ui';
import { useTransactionStore } from '@/features/activity/transaction-store';
import { useCategoryStore } from '@/features/category/category-store';
import { useWalletStore } from '@/features/wallet/wallet-store';
import { RutinPanel } from '@/features/recurring/components/rutin-panel';
import { groupByDay, monthSummary, signedAmount, timeLabel } from '@/features/activity/display';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

type Filter = { id: 'all' | TransactionKind; label: string };
const FILTERS: Filter[] = [
  { id: 'all', label: 'Semua' },
  { id: 'expense', label: 'Pengeluaran' },
  { id: 'income', label: 'Pemasukan' },
  { id: 'transfer', label: 'Transfer' },
];

const MINI = [12, 18, 24, 16, 28, 22, 32, 26, 36, 30, 38, 28];

function initial(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() : '?';
}

function Avatar({ color, letter }: { color: string; letter: string }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="bodySm" color="#fff" style={{ fontSize: 13, fontWeight: '700' }}>
        {letter}
      </Text>
    </View>
  );
}

function TxRow({
  tx,
  category,
  wallet,
  onPress,
  divider,
}: {
  tx: TransactionDto;
  category?: CategoryDto;
  wallet?: WalletDto;
  onPress: () => void;
  divider: boolean;
}) {
  const title = tx.note?.trim() || category?.name || 'Transaksi';
  const color = category?.color ?? palette.moss;
  const amt = signedAmount(tx);
  const meta = [category?.name, timeLabel(tx.transacted_at), wallet?.provider_name]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        opacity: pressed ? 0.7 : 1,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: palette.inkFaint,
      })}>
      <Avatar color={color} letter={initial(title)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="bodySm"
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '500', letterSpacing: -0.2 }}>
          {title}
        </Text>
        <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 1 }}>
          {meta}
        </Text>
      </View>
      <Text
        variant="mono"
        color={amt > 0 ? palette.cool : palette.ink}
        style={{ fontSize: 13, fontWeight: '500' }}>
        {rupiah(amt, { short: true })}
      </Text>
    </Pressable>
  );
}

function AktivitasPanel({
  items,
  status,
  categoryById,
  walletById,
  onTx,
}: {
  items: TransactionDto[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  categoryById: Map<string, CategoryDto>;
  walletById: Map<string, WalletDto>;
  onTx: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter['id']>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((t) => t.kind === filter)),
    [items, filter],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const summary = useMemo(() => monthSummary(items), [items]);

  const isLoading = status === 'loading' && items.length === 0;
  const isEmpty = status === 'ready' && filtered.length === 0;

  return (
    <View>
      {/* month summary */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ flex: 1 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{ fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700' }}>
            Bulan ini
          </Text>
          <Text variant="figureM" style={{ fontSize: 26, letterSpacing: -0.8, marginTop: 4 }}>
            {rupiah(-summary.expense, { short: true })}
          </Text>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
            {rupiah(summary.income, { short: true })} masuk · {summary.count} transaksi
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 }}>
          {MINI.map((h, i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: h,
                borderRadius: 3,
                backgroundColor: i > 8 ? palette.moss : palette.sand,
              }}
            />
          ))}
        </View>
      </View>

      {/* filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14, overflow: 'visible' }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingVertical: 3,
          gap: 6,
          flexDirection: 'row',
        }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                haptics.select();
                setFilter(f.id);
              }}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? palette.moss : palette.card,
                boxShadow: active ? undefined : `0 0 0 1px ${palette.inkFaint}`,
              }}>
              <Text
                variant="chip"
                color={active ? ONDARK : palette.ink}
                style={{ fontSize: 12, fontWeight: '600' }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkMute}>
            Memuat transaksi…
          </Text>
        </View>
      ) : isEmpty ? (
        <View style={{ marginHorizontal: 18, marginTop: 40, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkSoft} style={{ textAlign: 'center' }}>
            {filter === 'all'
              ? 'Belum ada transaksi. Catat yang pertama lewat tombol +.'
              : 'Tidak ada transaksi di filter ini.'}
          </Text>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ marginHorizontal: 18, marginTop: 18 }}>
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
                {g.header}
              </Text>
              <Text variant="mono" color={palette.inkSoft} style={{ fontSize: 11 }}>
                {rupiah(g.sum, { short: true })}
              </Text>
            </View>
            <View
              style={{ backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
              {g.items.map((t, i) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  category={t.category_id ? categoryById.get(t.category_id) : undefined}
                  wallet={walletById.get(t.wallet_id)}
                  onPress={() => onTx(t.id)}
                  divider={i < g.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export function TransaksiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'aktivitas' | 'rutin'>(
    modeParam === 'rutin' ? 'rutin' : 'aktivitas',
  );
  const [addOpen, setAddOpen] = useState(false);

  const { items, status, fetch: fetchTx } = useTransactionStore();
  const categories = useCategoryStore((s) => s.items);
  const fetchCategories = useCategoryStore((s) => s.fetch);
  const wallets = useWalletStore((s) => s.wallets);
  const fetchWallets = useWalletStore((s) => s.fetch);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    void fetchTx();
    if (categories.length === 0) void fetchCategories();
    if (wallets.length === 0) void fetchWallets();
  }, []);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  const go = (to: Href) => {
    setAddOpen(false);
    haptics.tap();
    router.push(to);
  };
  const goTx = (id: string) =>
    router.push(`/(app)/transaksi-detail?id=${encodeURIComponent(id)}` as Href);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading'}
            onRefresh={() => void fetchTx()}
          />
        }>
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
                Mei 2026
              </Text>
              <Text
                variant="displayM"
                style={{ fontSize: 36, letterSpacing: -1.6, lineHeight: 38, marginTop: 4 }}>
                Transaksi
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['search', 'filter'] as const).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => haptics.tap()}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 38,
                    backgroundColor: palette.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={n} size={n === 'search' ? 16 : 14} color={palette.ink} />
                </Pressable>
              ))}
            </View>
          </View>

          {/* segmented */}
          <View
            style={{
              marginHorizontal: 18,
              marginTop: 18,
              flexDirection: 'row',
              gap: 4,
              backgroundColor: palette.card,
              borderRadius: 999,
              padding: 4,
            }}>
            {(['aktivitas', 'rutin'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    haptics.select();
                    setMode(m);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 999,
                    alignItems: 'center',
                    backgroundColor: on ? palette.moss : 'transparent',
                  }}>
                  <Text
                    variant="chip"
                    color={on ? ONDARK : palette.inkSoft}
                    style={{ fontSize: 12.5, fontWeight: '700' }}>
                    {m === 'aktivitas' ? 'Aktivitas' : 'Rutin'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'aktivitas' ? (
            <AktivitasPanel
              items={items}
              status={status}
              categoryById={categoryById}
              walletById={walletById}
              onTx={goTx}
            />
          ) : (
            <RutinPanel />
          )}
        </Screen>
      </ScrollView>

      {/* FAB — in Aktivitas mode opens an inline chooser; in Rutin mode
          there's only one add destination so it goes there directly. */}
      <Pressable
        onPress={() => {
          haptics.tap();
          if (mode === 'rutin') {
            router.push('/(app)/tambah-rutin' as Href);
            return;
          }
          setAddOpen((v) => !v);
        }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 84,
          width: 56,
          height: 56,
          borderRadius: 56,
          backgroundColor: palette.moss,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 22px rgba(31,42,31,0.32)',
        }}>
        <Icon
          name={mode === 'aktivitas' && addOpen ? 'x' : 'plus'}
          size={mode === 'aktivitas' && addOpen ? 14 : 18}
          color={palette.lime}
        />
      </Pressable>

      {/* add chooser — Aktivitas only */}
      {mode === 'aktivitas' && addOpen && (
        <>
          <Pressable
            onPress={() => setAddOpen(false)}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              right: 20,
              bottom: insets.bottom + 150,
              width: 210,
              backgroundColor: palette.card,
              borderRadius: 18,
              borderCurve: 'continuous',
              paddingVertical: 6,
              boxShadow: '0 12px 30px rgba(10,10,14,0.18)',
            }}>
            {(
              [
                {
                  l: 'Tulis manual',
                  s: 'Catat sendiri',
                  i: 'plus' as IconName,
                  to: '/(app)/tambah-transaksi',
                },
                {
                  l: 'Scan struk',
                  s: 'OCR otomatis',
                  i: 'image' as IconName,
                  to: '/(app)/scan-struk',
                },
              ]
            ).map((a, i) => (
              <Pressable
                key={a.l}
                onPress={() => go(a.to as Href)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderBottomWidth: i === 0 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    backgroundColor: palette.limeSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={a.i} size={15} color={palette.moss} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" style={{ fontSize: 13.5, fontWeight: '600' }}>
                    {a.l}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 11, marginTop: 1 }}>
                    {a.s}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TabBar active="transaksi" />
    </View>
  );
}
