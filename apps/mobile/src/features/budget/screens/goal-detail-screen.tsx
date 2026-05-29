import { type GoalDto } from '@rapih/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons/icon';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { getGoal } from '@/features/goal/api';
import { useGoalStore } from '@/features/goal/goal-store';
import { haptics } from '@/lib/haptics';
import { rupiah } from '@/lib/money';
import { palette } from '@/theme';
import { TabungSheet } from '../components/tabung-sheet';

const ONDARK = palette.onDark;
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function deadlineLabel(iso: string | null): string {
  if (!iso) return 'Tanpa target';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

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

export function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const fromStore = useGoalStore((s) => (id ? s.goals.find((g) => g.id === id) : undefined));
  const update = useGoalStore((s) => s.update);
  const remove = useGoalStore((s) => s.remove);

  const [fetched, setFetched] = useState<GoalDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const goal = fromStore ?? fetched;

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on id only
  useEffect(() => {
    if (id && !fromStore) {
      getGoal(id)
        .then(setFetched)
        .catch(() => setFetched(null));
    }
  }, [id]);

  const derived = useMemo(() => {
    if (!goal) return null;
    const saved = Number(goal.saved_amount);
    const target = Number(goal.target_amount);
    const pct = Math.min(100, Math.round(goal.progress * 100));
    return { saved, target, pct, remaining: Math.max(0, target - saved) };
  }, [goal]);

  const onTabung = () => {
    haptics.tap();
    setSheetOpen(true);
  };

  const onTabungSubmit = async (add: number) => {
    if (!goal || add <= 0) return;
    setBusy(true);
    try {
      const next = Number(goal.saved_amount) + add;
      await update(goal.id, { saved_amount: String(next) });
      haptics.success();
      setSheetOpen(false);
    } catch (err) {
      Alert.alert('Gagal', err instanceof Error ? err.message : 'Gagal menabung.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!goal) return;
    Alert.alert('Hapus goal?', `"${goal.name}" akan dihapus permanen.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await remove(goal.id);
            haptics.success();
            router.back();
          } catch (err) {
            Alert.alert('Gagal', err instanceof Error ? err.message : 'Gagal menghapus goal.');
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!goal || !derived) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <Screen background={palette.bg} bottomInset={110}>
          <View style={{ paddingHorizontal: 22 }}>
            <HeaderBtn
              name="chevronLeft"
              onPress={() => {
                haptics.tap();
                router.back();
              }}
            />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={palette.moss} />
          </View>
        </Screen>
        <TabBar active="budget" />
      </View>
    );
  }

  const done = goal.progress >= 1;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={110}>
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
          <Text variant="bodySm" color={palette.inkSoft} style={{ fontSize: 11.5, fontWeight: '500' }}>
            Goal · {done ? 'selesai' : 'aktif'}
          </Text>
          <HeaderBtn name="more" onPress={onDelete} />
        </View>

        {/* hero — moss card */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 20,
            padding: 22,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            overflow: 'hidden',
            boxShadow: '0 12px 28px rgba(31,42,31,0.28)',
          }}>
          <Glow size={220} color={palette.lime} opacity={0.22} fadeAt={0.7} position={{ top: -60, right: -60 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(184,232,194,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 24 }}>{goal.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="eyebrow" color={palette.lime} style={{ fontSize: 10.5, letterSpacing: 1.5 }}>
                Tujuan tabungan
              </Text>
              <Text
                variant="figureL"
                color={ONDARK}
                style={{ fontSize: 30, letterSpacing: -1.2, lineHeight: 32, marginTop: 4 }}>
                {goal.name}
              </Text>
            </View>
          </View>

          {/* number */}
          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text
              variant="figureXL"
              color={ONDARK}
              style={{ fontSize: 44, letterSpacing: -1.8, lineHeight: 46 }}>
              {rupiah(derived.saved, { short: true })}
            </Text>
            <Text variant="bodySm" color="rgba(240,240,232,0.65)" style={{ fontSize: 12 }}>
              / {rupiah(derived.target, { short: true })}
            </Text>
          </View>

          {/* progress */}
          <View
            style={{
              marginTop: 14,
              height: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.10)',
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: `${derived.pct}%`,
                backgroundColor: palette.lime,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 6,
              }}>
              {derived.pct >= 18 && (
                <Text variant="mono" color={palette.moss} style={{ fontSize: 9, fontWeight: '800' }}>
                  {derived.pct}%
                </Text>
              )}
            </View>
          </View>

          {/* stat row */}
          <View style={{ marginTop: 18, flexDirection: 'row', gap: 14 }}>
            {[
              { l: 'Sisa', v: rupiah(derived.remaining, { short: true }) },
              { l: 'Target', v: deadlineLabel(goal.deadline) },
              { l: 'Progress', v: `${derived.pct}%` },
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

        {/* actions */}
        <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={onTabung}
            disabled={busy}
            style={{
              flex: 1.6,
              height: 52,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: palette.moss,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: busy ? 0.5 : 1,
            }}>
            <Icon name="plus" size={14} color={palette.lime} />
            <Text variant="bodySm" color={palette.lime} style={{ fontSize: 13.5, fontWeight: '700' }}>
              Tabung sekarang
            </Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            disabled={busy}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              borderCurve: 'continuous',
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
        </View>
      </Screen>

      <TabBar active="budget" />

      <TabungSheet
        visible={sheetOpen}
        goalName={goal.name}
        busy={busy}
        onClose={() => setSheetOpen(false)}
        onSubmit={onTabungSubmit}
      />
    </View>
  );
}
