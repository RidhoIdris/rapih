import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { palette, tint } from '@/theme';
import { Glow, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Goal = {
  name: string;
  emoji: string;
  /** terkumpul, in juta */
  cur: number;
  /** target, in juta */
  tgt: number;
  due: string;
  accent: string;
  big?: boolean;
};

const GOALS: Goal[] = [
  { name: 'Liburan Bali', emoji: '🌴', cur: 9.8, tgt: 13.2, due: '14 Sep 2026', accent: palette.cool, big: true },
  { name: 'Dana Darurat', emoji: '🛡️', cur: 12, tgt: 18, due: 'Target 3× gaji', accent: palette.coral },
  { name: 'Masa Depan', emoji: '🌱', cur: 5.4, tgt: 20, due: 'Tabungan jangka panjang', accent: palette.cool },
  { name: 'Laptop baru', emoji: '💻', cur: 4.2, tgt: 12.0, due: 'Akhir tahun', accent: tint.gold },
  { name: 'DP rumah', emoji: '🏠', cur: 28, tgt: 120, due: '2028', accent: palette.moss },
  { name: 'Beli iPhone', emoji: '📱', cur: 8.5, tgt: 18, due: 'Q4 2026', accent: tint.irisInk },
  { name: 'Umroh ibu', emoji: '🕌', cur: 14, tgt: 35, due: '2027', accent: palette.mossSoft },
];

const FILTERS = ['Aktif', 'Selesai', 'Tertunda'] as const;
const BARS = [1, 1, 1, 0.6, 0.3, 0, 0];

/** Convert a 7-char `#rrggbb` hex into rgba; passes through any other format. */
function alphaHex(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function GoalCard({ g, onPress }: { g: Goal; onPress: () => void }) {
  const pct = Math.min(100, Math.round((g.cur / g.tgt) * 100));
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: g.big ? undefined : 1,
        width: g.big ? '100%' : undefined,
        minHeight: g.big ? 160 : 144,
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
          backgroundColor: alphaHex(g.accent, 0.12),
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: alphaHex(g.accent, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 18 }}>{g.emoji}</Text>
        </View>
        <Text
          variant="bodySm"
          color={palette.inkMute}
          style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>
          {g.due}
        </Text>
      </View>

      <View style={{ marginTop: 14 }}>
        {g.big ? (
          <Text
            variant="figureS"
            style={{ fontSize: 22, letterSpacing: -0.6, lineHeight: 24, marginBottom: 8 }}>
            {g.name}
          </Text>
        ) : (
          <Text
            variant="bodySm"
            style={{ fontSize: 14, fontWeight: '600', letterSpacing: -0.2, marginBottom: 8 }}>
            {g.name}
          </Text>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}>
          <Text variant="mono" style={{ fontSize: 12, fontWeight: '600' }}>
            Rp {String(g.cur).replace('.', ',')}jt
          </Text>
          <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
            /{String(g.tgt).replace('.', ',')}jt
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
          <View
            style={{
              height: '100%',
              width: `${pct}%`,
              backgroundColor: g.accent,
              borderRadius: 4,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 4,
          }}>
          <Text variant="mono" color={g.accent} style={{ fontSize: 10, fontWeight: '700' }}>
            {pct}%
          </Text>
          {pct < 50 && (
            <Text
              variant="bodySm"
              color={palette.inkMute}
              style={{ fontSize: 9.5, fontWeight: '600' }}>
              perlu nabung lebih
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Goals content (saving goals). Rendered as the "Goal" mode of the Budget
 * hub. Standalone — no header, no Screen, no TabBar.
 */
export function GoalsPanel() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Aktif');
  const goDetail = () => router.push('/(app)/goal-detail' as Href);

  // group small goals into pairs of 2 so each row has equal heights
  const small = GOALS.filter((g) => !g.big);
  const big = GOALS.find((g) => g.big);
  const pairs: [Goal, Goal | undefined][] = [];
  for (let i = 0; i < small.length; i += 2) pairs.push([small[i], small[i + 1]]);

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
        <Glow
          size={150}
          color={palette.lime}
          opacity={0.18}
          fadeAt={0.7}
          position={{ top: -40, right: -40 }}
        />
        <Text
          variant="eyebrow"
          color={palette.lime}
          style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
          Total terkumpul
        </Text>
        <Text
          variant="figureXL"
          color={ONDARK}
          style={{ fontSize: 40, letterSpacing: -1.8, lineHeight: 42, marginTop: 6 }}>
          Rp 64,5jt
        </Text>
        <Text
          variant="bodySm"
          color="rgba(240,240,232,0.55)"
          style={{ fontSize: 11, marginTop: 4 }}>
          dari target Rp 198jt · {GOALS.length} goal aktif · 2 selesai
        </Text>
        <View
          style={{
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowUp" size={12} color={palette.lime} />
            <Text variant="mono" color={palette.lime} style={{ fontSize: 12, fontWeight: '700' }}>
              + Rp 1,8jt minggu ini
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {BARS.map((p, i) => (
              <View
                key={i}
                style={{
                  width: 4,
                  height: 22,
                  borderRadius: 4,
                  backgroundColor: p > 0.5 ? palette.lime : 'rgba(255,255,255,0.18)',
                  opacity: p === 0 ? 0.4 : 1,
                }}
              />
            ))}
          </View>
        </View>
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
                boxShadow: on ? undefined : `0 0 0 1px ${palette.inkFaint}`,
              }}>
              <Text
                variant="chip"
                color={on ? ONDARK : palette.ink}
                style={{ fontSize: 12, fontWeight: '600' }}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* goals grid */}
      <View style={{ marginHorizontal: 18, marginTop: 14, gap: 10 }}>
        {big && <GoalCard g={big} onPress={goDetail} />}
        {pairs.map((pair, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <GoalCard g={pair[0]} onPress={goDetail} />
            {pair[1] ? (
              <GoalCard g={pair[1]} onPress={goDetail} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        ))}
      </View>

      {/* dashed add */}
      <Pressable
        onPress={() => {
          haptics.tap();
          router.push('/(app)/tambah-goal' as Href);
        }}
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
        <Text
          variant="bodySm"
          color={palette.inkSoft}
          style={{ fontSize: 13, fontWeight: '500' }}>
          Buat goal baru
        </Text>
      </Pressable>
    </View>
  );
}
