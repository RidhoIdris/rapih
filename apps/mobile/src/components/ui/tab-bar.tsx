import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

import { Text } from './text';

export type TabId = 'beranda' | 'budget' | 'tanya' | 'transaksi' | 'saya';

type SideTab = { id: Exclude<TabId, 'tanya'>; label: string; d: string };

const TABS: SideTab[] = [
  { id: 'beranda', label: 'Beranda', d: 'M2 8l8-6 8 6v9a1 1 0 01-1 1h-4v-6h-6v6H3a1 1 0 01-1-1V8z' },
  { id: 'budget', label: 'Budget', d: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z' },
  { id: 'transaksi', label: 'Transaksi', d: 'M5 2.5H15V17L12.6 15.6 10 17 7.4 15.6 5 17Z' },
  { id: 'saya', label: 'Saya', d: 'M10 10a4 4 0 100-8 4 4 0 000 8zM2 18a8 8 0 0116 0' },
];

/** Tabs that have a real route. Others (not built yet) only buzz. */
const ROUTES: Partial<Record<TabId, Href>> = {
  beranda: '/(app)/beranda' as Href,
  budget: '/(app)/budget' as Href,
  transaksi: '/(app)/transaksi' as Href,
  tanya: '/(app)/tanya' as Href,
  saya: '/(app)/saya' as Href,
};

function TabGlyph({ d, active }: { d: string; active: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d={d}
        stroke={active ? palette.ink : palette.inkMute}
        strokeWidth={active ? 1.8 : 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={active ? palette.lime : 'none'}
        opacity={active ? 1 : 0.9}
      />
    </Svg>
  );
}

type Props = {
  active: TabId;
  /** Override routing for a tap. Default: navigate via the ROUTES map. */
  onTab?: (id: TabId) => void;
};

/**
 * Floating bottom navigation. Four side tabs + a raised center "Tanya"
 * sparkle button. Self-routes via the ROUTES map (callers don't wire
 * navigation); tabs without a route just buzz. Fades the scrolling
 * content out behind it with an SVG gradient (no native gradient dep).
 */
export function TabBar({ active, onTab }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const press = (id: TabId) => {
    haptics.tap();
    if (onTab) {
      onTab(id);
      return;
    }
    if (id === active) return;
    const to = ROUTES[id];
    if (to) router.push(to);
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 8,
        paddingBottom: insets.bottom + 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        backgroundColor: 'white'
      }}>

      {TABS.slice(0, 2).map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => press(t.id)}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 3,
              paddingTop: 6,
              paddingBottom: 2,
            }}>
            <TabGlyph d={t.d} active={isActive} />
            <Text
              variant="bodySm"
              color={isActive ? palette.ink : palette.inkMute}
              style={{ fontSize: 10, fontWeight: '500', letterSpacing: 0.1 }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}

      {/* center — Tanya */}
      <Pressable
        onPress={() => press('tanya')}
        style={{
          width: 58,
          height: 58,
          marginTop: -18,
          marginBottom: -4,
          borderRadius: 58,
          backgroundColor: palette.moss,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow:
            '0 8px 22px rgba(31,42,31,0.32), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
        <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <Path
            d="M11 2l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5L3.5 9.5l5.5-2L11 2z"
            fill={palette.lime}
          />
        </Svg>
      </Pressable>

      {TABS.slice(2).map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => press(t.id)}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 3,
              paddingTop: 6,
              paddingBottom: 2,
            }}>
            <TabGlyph d={t.d} active={isActive} />
            <Text
              variant="bodySm"
              color={isActive ? palette.ink : palette.inkMute}
              style={{ fontSize: 10, fontWeight: '500', letterSpacing: 0.1 }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
