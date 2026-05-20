import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { palette } from '@/theme';
import { Screen, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

const PERIODS = ['1H', '1M', '3B', '1T', '5T', 'Semua'] as const;

const META: [string, string][] = [
  ['Harga sekarang', 'Rp 9.450'],
  ['Modal awal', 'Rp 2.829.000'],
  ['Jumlah lot', '34 lot'],
  ['Rata-rata beli', 'Rp 8.320'],
  ['Pembelian terakhir', '02 Mei 2026'],
];

export function AsetDetailScreen() {
  const router = useRouter();

  return (
    <Screen background={palette.bg} bottomInset={28}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 22,
        }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="chevronLeft" size={14} color={palette.ink} />
        </Pressable>
        <Text variant="bodySm" style={{ fontSize: 12, fontWeight: '600' }}>
          BBCA · Bank Central Asia
        </Text>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 38,
            backgroundColor: palette.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="more" size={16} color={palette.ink} />
        </Pressable>
      </View>

      {/* hero value */}
      <View style={{ paddingHorizontal: 22, paddingTop: 28 }}>
        <Text
          variant="label"
          color={palette.inkMute}
          style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
          Nilai sekarang
        </Text>
        <Text
          variant="figureXL"
          style={{ fontSize: 48, letterSpacing: -2.2, lineHeight: 50, marginTop: 6 }}>
          Rp 3.180.000
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: palette.lime,
            }}>
            <Icon name="arrowUp" size={10} color={palette.moss} />
            <Text variant="chip" color={palette.moss} style={{ fontWeight: '700' }}>
              +12,4%
            </Text>
          </View>
          <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12 }}>
            +Rp 351rb dari modal awal
          </Text>
        </View>
      </View>

      {/* chart */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 20,
          paddingVertical: 18,
          paddingHorizontal: 18,
          borderRadius: 24,
          borderCurve: 'continuous',
          backgroundColor: palette.card,
        }}>
        {/* period pills */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {PERIODS.map((p, i) => {
            const on = i === 2;
            return (
              <Pressable
                key={p}
                onPress={() => haptics.select()}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: on ? palette.moss : 'transparent',
                }}>
                <Text
                  variant="bodySm"
                  color={on ? ONDARK : palette.inkSoft}
                  style={{ fontSize: 11.5, fontWeight: '600' }}>
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* SVG chart */}
        <Svg width="100%" height={160} viewBox="0 0 340 160" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="aFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={palette.cool} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={palette.cool} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Line
            x1={0}
            y1={125}
            x2={340}
            y2={125}
            stroke={palette.inkFaint}
            strokeDasharray="2 4"
          />
          <Path
            d="M0 125 L25 116 L50 122 L75 106 L100 112 L125 96 L150 108 L175 86 L200 97 L225 75 L250 82 L275 60 L300 68 L325 47 L340 40 L340 160 L0 160 Z"
            fill="url(#aFill)"
          />
          <Path
            d="M0 125 L25 116 L50 122 L75 106 L100 112 L125 96 L150 108 L175 86 L200 97 L225 75 L250 82 L275 60 L300 68 L325 47 L340 40"
            fill="none"
            stroke={palette.cool}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Circle cx={275} cy={60} r={12} fill={palette.cool} opacity={0.15} />
          <Circle cx={275} cy={60} r={4.5} fill={palette.cool} />
          <Rect x={242} y={32} width={70} height={20} rx={6} fill={palette.ink} />
          <SvgText
            x={277}
            y={46}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fontWeight="500">
            Rp 9.450
          </SvgText>
        </Svg>
      </View>

      {/* meta */}
      <View
        style={{
          marginHorizontal: 18,
          marginTop: 14,
          backgroundColor: palette.card,
          borderRadius: 22,
          borderCurve: 'continuous',
        }}>
        {META.map(([l, v], i) => (
          <View
            key={l}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderBottomWidth: i < META.length - 1 ? 1 : 0,
              borderBottomColor: palette.inkFaint,
            }}>
            <Text variant="bodySm" color={palette.inkMute} style={{ fontSize: 12, fontWeight: '500' }}>
              {l}
            </Text>
            <Text variant="mono" style={{ fontSize: 13, fontWeight: '500' }}>
              {v}
            </Text>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <View style={{ marginHorizontal: 18, marginTop: 18, flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: palette.inkFaint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" style={{ fontSize: 14, fontWeight: '700' }}>
            Jual
          </Text>
        </Pressable>
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            flex: 2,
            height: 52,
            borderRadius: 26,
            backgroundColor: palette.lime,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="bodySm" color={palette.moss} style={{ fontSize: 14, fontWeight: '700' }}>
            Beli lagi
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
