import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/theme';
import { Screen, TabBar, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

import { BudgetPanel } from '../components/budget-panel';
import { GoalsPanel } from '../components/goals-panel';

const ONDARK = palette.onDark;

type Mode = 'budget' | 'goal';

/**
 * Budget hub. Mirrors the Transaksi hub: a segmented "Budget | Goal"
 * header that swaps between two panels. The "Budget" tab in the bottom
 * TabBar routes here; `?mode=goal` deep-links straight into goals (used
 * by Beranda's "Goal" quick tile in the future).
 *
 * FAB:
 *   • goal mode  → push /(app)/tambah-goal
 *   • budget mode → push /(app)/tambah-budget
 */
export function BudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(modeParam === 'goal' ? 'goal' : 'budget');

  const goAdd = (m: Mode) => {
    haptics.tap();
    router.push((m === 'goal' ? '/(app)/tambah-goal' : '/(app)/tambah-budget') as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
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
              {mode === 'budget' ? 'Budget' : 'Goal'}
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
          {(['budget', 'goal'] as const).map((m) => {
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
                  {m === 'budget' ? 'Budget' : 'Goal'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'budget' ? (
          <BudgetPanel goAdd={() => goAdd('budget')} />
        ) : (
          <GoalsPanel goAdd={() => goAdd('goal')} />
        )}
      </Screen>

      {/* FAB — different add destination per mode */}
      <Pressable
        onPress={() => goAdd(mode)}
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
        <Icon name="plus" size={18} color={palette.lime} />
      </Pressable>

      <TabBar active="budget" />
    </View>
  );
}
