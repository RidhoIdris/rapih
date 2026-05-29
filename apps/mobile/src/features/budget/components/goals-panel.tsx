import type { GoalDto } from '@rapih/shared';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { Glow, Text } from '@/components/ui';
import { useGoalStore } from '@/features/goal/goal-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';

const ONDARK = palette.onDark;

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const FILTERS = ['Semua', 'Aktif', 'Selesai'] as const;
type Filter = (typeof FILTERS)[number];

function deadlineLabel(iso: string | null): string {
  if (!iso) return 'Tanpa target';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Convert a 7-char `#rrggbb` hex into rgba; passes through any other format. */
function alphaHex(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function GoalCard({ g, big, onPress }: { g: GoalDto; big: boolean; onPress: () => void }) {
  const pct = Math.min(100, Math.round(g.progress * 100));
  const saved = Number(g.saved_amount);
  const target = Number(g.target_amount);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: big ? undefined : 1,
        width: big ? '100%' : undefined,
        minHeight: big ? 160 : 144,
        padding: 16,
        borderRadius: 22,
        borderCurve: 'continuous',
        backgroundColor: palette.card,
        position: 'relative',
        overflow: 'hidden',
      }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 90,
          height: 90,
          borderRadius: 90,
          backgroundColor: alphaHex(g.color, 0.12),
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: alphaHex(g.color, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 18 }}>{g.icon}</Text>
        </View>
        <Text
          variant="bodySm"
          color={palette.inkMute}
          style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>
          {deadlineLabel(g.deadline)}
        </Text>
      </View>

      <View style={{ marginTop: 14 }}>
        <Text
          variant={big ? 'figureS' : 'bodySm'}
          numberOfLines={1}
          style={
            big
              ? { fontSize: 22, letterSpacing: -0.6, lineHeight: 24, marginBottom: 8 }
              : { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, marginBottom: 8 }
          }>
          {g.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="mono" style={{ fontSize: 12, fontWeight: '600' }}>
            {rupiah(saved, { short: true })}
          </Text>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
            /{rupiah(target, { short: true }).replace('Rp ', '')}
          </Text>
        </View>
        <View
          style={{
            height: 4,
            borderRadius: 4,
            backgroundColor: palette.sand,
            marginTop: 8,
            overflow: 'hidden',
          }}>
          <View style={{ height: '100%', width: `${pct}%`, backgroundColor: g.color, borderRadius: 4 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text variant="mono" color={g.color} style={{ fontSize: 10, fontWeight: '700' }}>
            {pct}%
          </Text>
          {pct >= 100 ? (
            <Text variant="bodySm" color={palette.cool} style={{ fontSize: 9.5, fontWeight: '700' }}>
              tercapai 🎉
            </Text>
          ) : pct < 50 ? (
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 9.5, fontWeight: '600' }}>
              perlu nabung lebih
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Goals content (saving goals). Rendered as the "Goal" mode of the Budget
 * hub. Standalone — no header, no Screen, no TabBar.
 */
export function GoalsPanel({ goAdd }: { goAdd: () => void }) {
  const router = useRouter();
  const { goals, status, fetch } = useGoalStore();
  const [filter, setFilter] = useState<Filter>('Semua');

  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    void fetch();
  }, []);

  const totals = useMemo(() => {
    const saved = goals.reduce((s, g) => s + Number(g.saved_amount), 0);
    const target = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const done = goals.filter((g) => g.progress >= 1).length;
    return { saved, target, done, active: goals.length - done };
  }, [goals]);

  const filtered = useMemo(() => {
    if (filter === 'Aktif') return goals.filter((g) => g.progress < 1);
    if (filter === 'Selesai') return goals.filter((g) => g.progress >= 1);
    return goals;
  }, [goals, filter]);

  const goDetail = (id: string) =>
    router.push(`/(app)/goal-detail?id=${encodeURIComponent(id)}` as Href);

  // First card spans full width; the rest pair up two-per-row.
  const [big, ...rest] = filtered;
  const pairs: [GoalDto, GoalDto | undefined][] = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);

  const isLoading = status === 'loading' && goals.length === 0;
  const isEmpty = status === 'ready' && filtered.length === 0;

  return (
    <View style={{ paddingBottom: 8 }}>
      {/* hero — total terkumpul */}
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
          Total terkumpul
        </Text>
        <Text
          variant="figureXL"
          color={ONDARK}
          style={{ fontSize: 40, letterSpacing: -1.8, lineHeight: 42, marginTop: 6 }}>
          {rupiah(totals.saved, { short: true })}
        </Text>
        <Text variant="bodySm" color="rgba(240,240,232,0.55)" style={{ fontSize: 11, marginTop: 4 }}>
          dari target {rupiah(totals.target, { short: true })} · {totals.active} aktif · {totals.done} selesai
        </Text>
      </View>

      {/* filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14 }}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 6, flexDirection: 'row' }}>
        {FILTERS.map((t) => {
          const on = filter === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                haptics.select();
                setFilter(t);
              }}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: on ? palette.moss : palette.card,
                borderWidth: 1,
                borderColor: on ? palette.moss : palette.inkFaint,
              }}>
              <Text variant="chip" color={on ? ONDARK : palette.ink} style={{ fontSize: 12, fontWeight: '600' }}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* goals grid */}
      {isLoading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkMute}>
            Memuat goal…
          </Text>
        </View>
      ) : isEmpty ? (
        <View style={{ marginHorizontal: 18, marginTop: 32, alignItems: 'center' }}>
          <Text variant="bodySm" color={palette.inkSoft} style={{ textAlign: 'center' }}>
            {filter === 'Semua'
              ? 'Belum ada goal. Mulai nabung buat sesuatu yang kamu mau.'
              : 'Tidak ada goal di filter ini.'}
          </Text>
        </View>
      ) : (
        <View style={{ marginHorizontal: 18, marginTop: 14, gap: 10 }}>
          {big && <GoalCard g={big} big onPress={() => goDetail(big.id)} />}
          {pairs.map(([a, b]) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: 10 }}>
              <GoalCard g={a} big={false} onPress={() => goDetail(a.id)} />
              {b ? (
                <GoalCard g={b} big={false} onPress={() => goDetail(b.id)} />
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          ))}
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
          Buat goal baru
        </Text>
      </Pressable>
    </View>
  );
}
