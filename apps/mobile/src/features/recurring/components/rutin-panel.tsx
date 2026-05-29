import type { RecurringDto } from '@rapih/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Text } from '@/components/ui';
import { useRecurringStore } from '@/features/recurring/recurring-store';
import {
  currentInstallment,
  daysUntil,
  dueDay,
  fmtDate,
  installmentProgress,
  isInstallment,
  remainingCount,
} from '@/features/recurring/display';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';

const ONDARK = palette.onDark;

function statusOf(r: RecurringDto): { c: string; l: string } {
  if (r.is_complete) return { c: palette.cool, l: 'Lunas' };
  const d = daysUntil(r.next_due_date);
  if (d < 0) return { c: palette.coral, l: 'Telat' };
  if (d <= 7) return { c: tint.goldInk, l: 'Sebentar lagi' };
  return { c: palette.inkMute, l: 'Terjadwal' };
}

function Row({ r, last, onPress }: { r: RecurringDto; last: boolean; onPress: () => void }) {
  const st = statusOf(r);
  const installment = isInstallment(r);
  const progress = installmentProgress(r);

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.inkFaint,
        opacity: r.is_complete ? 0.6 : 1,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: `${r.color}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 18 }}>{r.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodySm" numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
            {r.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {installment && (
              <>
                <Text variant="mono" color={palette.inkMute} style={{ fontSize: 11 }}>
                  ke-{currentInstallment(r)}/{r.total_occurrences}
                </Text>
                <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11 }}>·</Text>
              </>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: st.c }} />
              <Text variant="bodySm" color={st.c} style={{ fontSize: 10.5, fontWeight: '600' }}>
                {st.l}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="mono" style={{ fontSize: 13, fontWeight: '600' }}>
            {rupiah(Number(r.amount), { short: true })}
          </Text>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, marginTop: 2 }}>
            {r.is_complete ? `sisa ${remainingCount(r)}` : `tgl ${dueDay(r.next_due_date)}`}
          </Text>
        </View>
      </View>
      {installment && (
        <View style={{ height: 4, borderRadius: 4, backgroundColor: palette.sand, overflow: 'hidden', marginTop: 10 }}>
          <View style={{ height: '100%', width: `${Math.round(progress * 100)}%`, backgroundColor: r.color, borderRadius: 4 }} />
        </View>
      )}
    </Pressable>
  );
}

function Section({ title, items, onRow }: { title: string; items: RecurringDto[]; onRow: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginHorizontal: 18, marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 }}>
        <Text variant="label" color={palette.inkMute} style={{ fontSize: 11, letterSpacing: 1.4, fontWeight: '700' }}>
          {title}
        </Text>
        <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, fontWeight: '600' }}>
          {rupiah(items.filter((r) => !r.is_complete).reduce((s, r) => s + Number(r.amount), 0), { short: true })}
        </Text>
      </View>
      <View style={{ backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
        {items.map((r, i) => (
          <Row key={r.id} r={r} last={i === items.length - 1} onPress={() => onRow(r.id)} />
        ))}
      </View>
    </View>
  );
}

/** Recurring content. Rendered as the "Rutin" mode of the Transaksi hub. */
export function RutinPanel() {
  const router = useRouter();
  const { recurring, status, fetch } = useRecurringStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    void fetch();
  }, []);

  // Active (not fully paid) first, sorted by next due; completed sink to bottom.
  const sortBills = (a: RecurringDto, b: RecurringDto) => {
    if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
    return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
  };

  const expenses = useMemo(() => recurring.filter((r) => r.kind === 'expense').sort(sortBills), [recurring]);
  const incomes = useMemo(() => recurring.filter((r) => r.kind === 'income').sort(sortBills), [recurring]);

  const stats = useMemo(() => {
    const active = recurring.filter((r) => !r.is_complete);
    const expenseTotal = active.filter((r) => r.kind === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const incomeTotal = active.filter((r) => r.kind === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const late = active.filter((r) => daysUntil(r.next_due_date) < 0).length;
    return { expenseTotal, incomeTotal, late, count: active.length };
  }, [recurring]);

  const nextItem = useMemo(() => {
    return recurring
      .filter((r) => !r.is_complete && daysUntil(r.next_due_date) >= 0)
      .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())[0];
  }, [recurring]);

  const goDetail = (id: string) => router.push(`/(app)/rutin-detail?id=${encodeURIComponent(id)}` as Href);

  const isLoading = status === 'loading' && recurring.length === 0;
  const isEmpty = status === 'ready' && recurring.length === 0;

  return (
    <View style={{ paddingBottom: 8 }}>
      {/* hero total */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          paddingVertical: 18,
          paddingHorizontal: 20,
          borderRadius: 24,
          borderCurve: 'continuous',
          backgroundColor: palette.moss,
          overflow: 'hidden',
        }}>
        <Text variant="eyebrow" color={palette.lime} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Pengeluaran rutin / periode
        </Text>
        <Text variant="figureXL" color={ONDARK} style={{ fontSize: 40, letterSpacing: -1.8, lineHeight: 42, marginTop: 6 }}>
          {rupiah(stats.expenseTotal, { short: true })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
          {[
            { l: 'Tagihan', v: `${stats.count}`, c: ONDARK },
            { l: 'Masuk', v: rupiah(stats.incomeTotal, { short: true }), c: palette.lime },
            { l: 'Telat', v: `${stats.late}`, c: stats.late > 0 ? palette.coral : ONDARK },
          ].map((s, i) => (
            <View key={s.l} style={{ flex: 1, flexDirection: 'row', gap: 14 }}>
              {i > 0 && <View style={{ width: 1, backgroundColor: 'rgba(240,240,232,0.15)' }} />}
              <View style={{ flex: 1 }}>
                <Text variant="label" color="rgba(240,240,232,0.55)" style={{ fontSize: 10, letterSpacing: 0.8, fontWeight: '600' }}>
                  {s.l}
                </Text>
                <Text variant="mono" color={s.c} style={{ fontSize: 13, marginTop: 3 }}>
                  {s.v}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* upcoming alert */}
      {nextItem && (
        <Pressable
          onPress={() => { haptics.tap(); goDetail(nextItem.id); }}
          style={{
            marginHorizontal: 18,
            marginTop: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: tint.amber,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint.goldInk, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>{nextItem.kind === 'income' ? '💰' : '⏰'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" color={tint.amberInk} style={{ fontSize: 13, fontWeight: '700', letterSpacing: -0.2 }}>
              {nextItem.name} {nextItem.kind === 'income' ? 'masuk' : 'jatuh tempo'} {daysUntil(nextItem.next_due_date)} hari lagi
            </Text>
            <Text variant="bodySm" color="rgba(90,74,32,0.75)" style={{ fontSize: 11, marginTop: 1 }}>
              {rupiah(Number(nextItem.amount), { short: true })} · {fmtDate(nextItem.next_due_date)}
            </Text>
          </View>
          <Icon name="arrowR" size={14} color={tint.amberInk} />
        </Pressable>
      )}

      {isLoading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkMute}>Memuat tagihan…</Text>
        </View>
      ) : isEmpty ? (
        <View style={{ marginHorizontal: 18, marginTop: 32, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkSoft} style={{ textAlign: 'center' }}>
            Belum ada tagihan rutin. Tambah biar nggak kelupaan bayar (atau catat gaji rutin).
          </Text>
        </View>
      ) : (
        <>
          <Section title="Pengeluaran" items={expenses} onRow={goDetail} />
          <Section title="Pemasukan" items={incomes} onRow={goDetail} />
        </>
      )}

      {/* add dashed */}
      <Pressable
        onPress={() => { haptics.tap(); router.push('/(app)/tambah-rutin' as Href); }}
        style={{
          marginHorizontal: 18,
          marginTop: 18,
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
          Tambah tagihan rutin
        </Text>
      </Pressable>
    </View>
  );
}
