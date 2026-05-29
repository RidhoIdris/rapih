import type { BudgetDto } from '@rapih/shared';
import { useEffect, useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Glow, Text } from '@/components/ui';
import { useBudgetStore } from '@/features/budget/budget-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette, tint } from '@/theme';

const ONDARK = palette.onDark;

function flagOf(p: number): { l: string; c: string; bg: string } {
  if (p >= 100) return { l: 'Habis', c: palette.coral, bg: tint.peach };
  if (p >= 80) return { l: 'Hampir', c: tint.goldInk, bg: tint.amber };
  return { l: 'Aman', c: palette.cool, bg: palette.limeSoft };
}

function BucketRow({
  b,
  last,
  onLongPress,
}: {
  b: BudgetDto;
  last: boolean;
  onLongPress: () => void;
}) {
  const spent = Number(b.spent);
  const cap = Number(b.amount);
  const p = Math.min(100, Math.round(b.progress * 100));
  const sisa = Math.max(0, Number(b.remaining));
  const f = flagOf(Math.round(b.progress * 100));
  const sub =
    b.category_ids.length === 0
      ? 'Semua pengeluaran'
      : `${b.category_ids.length} kategori`;

  return (
    <Pressable
      onLongPress={onLongPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.inkFaint,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: `${b.color}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 18 }}>{b.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="bodySm"
            numberOfLines={1}
            style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
            {b.name}
          </Text>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 11, marginTop: 2 }}>
            {sub}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="mono" style={{ fontSize: 12.5, fontWeight: '600' }}>
            {rupiah(spent, { short: true })}
          </Text>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10, marginTop: 2 }}>
            / {rupiah(cap, { short: true }).replace('Rp ', '')}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <View
          style={{ height: 6, borderRadius: 6, backgroundColor: palette.sand, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${p}%`,
              backgroundColor: p >= 100 ? palette.coral : b.color,
              borderRadius: 6,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: f.bg }}>
              <Text variant="chip" color={f.c} style={{ fontSize: 9.5, fontWeight: '700' }}>
                {f.l}
              </Text>
            </View>
            <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, fontWeight: '600' }}>
              {p}%
            </Text>
          </View>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 10.5 }}>
            sisa {rupiah(sisa, { short: true })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Budget content (envelope buckets). Rendered as the "Budget" mode of the
 * Budget hub. Standalone — no header, no Screen, no TabBar.
 */
export function BudgetPanel({ goAdd }: { goAdd: () => void }) {
  const { budgets, status, fetch, remove } = useBudgetStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    void fetch();
  }, []);

  const totals = useMemo(() => {
    const spent = budgets.reduce((s, b) => s + Number(b.spent), 0);
    const cap = budgets.reduce((s, b) => s + Number(b.amount), 0);
    const remaining = budgets.reduce((s, b) => s + Math.max(0, Number(b.remaining)), 0);
    return { spent, cap, remaining, pct: cap > 0 ? Math.round((spent / cap) * 100) : 0 };
  }, [budgets]);

  const onDelete = (b: BudgetDto) => {
    haptics.tap();
    Alert.alert('Hapus budget?', `"${b.name}" akan dihapus.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => void remove(b.id) },
    ]);
  };

  const isLoading = status === 'loading' && budgets.length === 0;
  const isEmpty = status === 'ready' && budgets.length === 0;

  return (
    <View style={{ paddingBottom: 8 }}>
      {/* hero — total alokasi */}
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
        <Glow size={150} color={palette.lime} opacity={0.18} fadeAt={0.7} position={{ top: -40, right: -40 }} />
        <Text variant="eyebrow" color={palette.lime} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Dipakai bulan ini
        </Text>
        <Text
          variant="figureXL"
          color={ONDARK}
          style={{ fontSize: 40, letterSpacing: -1.8, lineHeight: 42, marginTop: 6 }}>
          {rupiah(totals.spent, { short: true })}
        </Text>
        <Text variant="bodySm" color="rgba(240,240,232,0.55)" style={{ fontSize: 11, marginTop: 4 }}>
          dari plafon {rupiah(totals.cap, { short: true })} · {totals.pct}%
        </Text>

        <View
          style={{
            marginTop: 14,
            height: 8,
            borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.18)',
            overflow: 'hidden',
          }}>
          <View
            style={{
              height: '100%',
              width: `${Math.min(100, totals.pct)}%`,
              backgroundColor: totals.pct >= 100 ? palette.coral : palette.lime,
              borderRadius: 8,
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
          {[
            { l: 'Envelope', v: `${budgets.length} aktif` },
            { l: 'Plafon', v: rupiah(totals.cap, { short: true }) },
            { l: 'Sisa', v: rupiah(totals.remaining, { short: true }) },
          ].map((s, i) => (
            <View key={s.l} style={{ flex: 1, flexDirection: 'row', gap: 14 }}>
              {i > 0 && <View style={{ width: 1, backgroundColor: 'rgba(240,240,232,0.15)' }} />}
              <View style={{ flex: 1 }}>
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

      {/* envelope list */}
      {isLoading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkMute}>
            Memuat budget…
          </Text>
        </View>
      ) : isEmpty ? (
        <View style={{ marginHorizontal: 18, marginTop: 32, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkSoft} style={{ textAlign: 'center' }}>
            Belum ada budget. Bikin envelope pertama buat ngatur pengeluaran.
          </Text>
        </View>
      ) : (
        <View style={{ marginHorizontal: 18, marginTop: 18 }}>
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
              Envelope bulan ini
            </Text>
            <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5, fontWeight: '600' }}>
              {budgets.length} aktif
            </Text>
          </View>
          <View style={{ backgroundColor: palette.card, borderRadius: 22, borderCurve: 'continuous' }}>
            {budgets.map((b, i) => (
              <BucketRow
                key={b.id}
                b={b}
                last={i === budgets.length - 1}
                onLongPress={() => onDelete(b)}
              />
            ))}
          </View>
        </View>
      )}

      {/* dashed add */}
      <Pressable
        onPress={goAdd}
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
          Tambah envelope baru
        </Text>
      </Pressable>
    </View>
  );
}
