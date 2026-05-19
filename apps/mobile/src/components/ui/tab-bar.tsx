import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { haptics } from '@/lib/haptics';
import { palette } from '@/theme';

import { Text } from './text';

export type TabId = 'beranda' | 'budget' | 'tanya' | 'kebiasaan' | 'saya';

type SideTab = { id: Exclude<TabId, 'tanya'>; label: string; d: string };

const TABS: SideTab[] = [
  { id: 'beranda', label: 'Beranda', d: 'M2 8l8-6 8 6v9a1 1 0 01-1 1h-4v-6h-6v6H3a1 1 0 01-1-1V8z' },
  { id: 'budget', label: 'Budget', d: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z' },
  { id: 'kebiasaan', label: 'Kebiasaan', d: 'M10 2C6 6 6 10 10 14M10 14C14 10 14 6 10 2M4 10c4-1 8-1 12 0' },
  { id: 'saya', label: 'Saya', d: 'M10 10a4 4 0 100-8 4 4 0 000 8zM2 18a8 8 0 0116 0' },
];

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
  onTab?: (id: TabId) => void;
};

/**
 * Floating bottom navigation. Four side tabs + a raised center "Tanya"
 * sparkle button. Fades the scrolling content out behind it with an SVG
 * gradient (no native gradient dependency).
 */
export function TabBar({ active, onTab }: Props) {
  const insets = useSafeAreaInsets();
  const press = (id: TabId) => {
    haptics.tap();
    onTab?.(id);
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
      {/* fade backdrop */}
      <Svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        pointerEvents="none">
        <Defs>
          <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.bgDeep} stopOpacity={0} />
            <Stop offset="0.45" stopColor={palette.bgDeep} stopOpacity={0.92} />
            <Stop offset="0.72" stopColor={palette.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tabFade)" />
      </Svg>

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
