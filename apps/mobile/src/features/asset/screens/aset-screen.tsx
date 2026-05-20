import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

import { palette, tint } from '@/theme';
import { Glow, Screen, TabBar, Text } from '@/components/ui';
import { Icon } from '@/components/icons/icon';
import { rupiah } from '@/lib/money';
import { haptics } from '@/lib/haptics';

const ONDARK = palette.onDark;

type Holding = {
  name: string;
  tick: string;
  amt: number;
  /** return % */
  ret: number;
  color: string;
};

const HOLDINGS: Holding[] = [
  { name: 'Bibit · Reksadana Pasar Uang', tick: 'RDPU', amt: 5_420_000, ret: 4.8, color: palette.cool },
  { name: 'Pluang · BBCA Saham', tick: 'BBCA', amt: 3_180_000, ret: 12.4, color: '#5e88c4' },
  { name: 'Pintu · BTC', tick: 'BTC', amt: 1_820_000, ret: -3.2, color: '#e8a05a' },
  { name: 'Pegadaian · Emas digital', tick: 'XAU', amt: 1_000_000, ret: 7.1, color: tint.gold },
];

const TOTAL = HOLDINGS.reduce((s, h) => s + h.amt, 0);
const C = 2 * Math.PI * 56;

const PERF = [
  { l: '1 hari', v: '+0,3%' },
  { l: '30 hari', v: '+1,8%' },
  { l: 'Setahun', v: '+8,4%' },
  { l: 'All-time', v: '+12,1%' },
];

export function AsetScreen() {
  const router = useRouter();

  // build donut segments
  let acc = 0;
  const segments = HOLDINGS.map((h) => {
    const frac = h.amt / TOTAL;
    const dash = frac * C;
    const offset = -acc * C;
    acc += frac;
    return { dash, offset, color: h.color };
  });

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Screen background={palette.bg} bottomInset={110}>
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
              {HOLDINGS.length} instrumen
            </Text>
            <Text
              variant="displayM"
              style={{ fontSize: 38, letterSpacing: -1.6, lineHeight: 40, marginTop: 4 }}>
              Aset
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push('/(app)/tambah-aset' as Href);
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 40,
              backgroundColor: palette.moss,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="plus" size={16} color={palette.lime} />
          </Pressable>
        </View>

        {/* hero with donut */}
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 22,
            paddingVertical: 20,
            paddingHorizontal: 22,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: palette.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
          }}>
          <View style={{ width: 130, height: 130, flexShrink: 0 }}>
            <Svg
              width={130}
              height={130}
              viewBox="0 0 130 130"
              style={{ transform: [{ rotate: '-90deg' }] }}>
              {segments.map((s, i) => (
                <Circle
                  key={i}
                  cx={65}
                  cy={65}
                  r={56}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={12}
                  strokeDasharray={`${s.dash} ${C}`}
                  strokeDashoffset={s.offset}
                />
              ))}
            </Svg>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                variant="label"
                color={palette.inkMute}
                style={{ fontSize: 9.5, letterSpacing: 1.2, fontWeight: '600' }}>
                Nilai aset
              </Text>
              <Text variant="figureS" style={{ fontSize: 22, letterSpacing: -0.8, marginTop: 2 }}>
                11,4jt
              </Text>
              <Text variant="mono" color={palette.cool} style={{ fontSize: 10.5, marginTop: 2 }}>
                +5,8% YTD
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {HOLDINGS.map((h) => (
              <View
                key={h.tick}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: h.color,
                    flexShrink: 0,
                  }}
                />
                <Text variant="bodySm" style={{ flex: 1, fontSize: 11.5 }}>
                  {h.tick}
                </Text>
                <Text variant="mono" color={palette.inkMute} style={{ fontSize: 10.5 }}>
                  {Math.round((h.amt / TOTAL) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* perf strip */}
        <View style={{ marginHorizontal: 18, marginTop: 12, flexDirection: 'row', gap: 8 }}>
          {PERF.map((p) => (
            <View
              key={p.l}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: palette.card,
                alignItems: 'center',
              }}>
              <Text
                variant="label"
                color={palette.inkMute}
                style={{ fontSize: 10, letterSpacing: 0.5, fontWeight: '600' }}>
                {p.l}
              </Text>
              <Text
                variant="mono"
                color={palette.cool}
                style={{ fontSize: 13, fontWeight: '600', marginTop: 3 }}>
                {p.v}
              </Text>
            </View>
          ))}
        </View>

        {/* holdings list */}
        <View style={{ marginHorizontal: 18, marginTop: 20 }}>
          <Text
            variant="label"
            color={palette.inkMute}
            style={{
              fontSize: 11,
              letterSpacing: 1.4,
              fontWeight: '700',
              paddingHorizontal: 4,
              paddingBottom: 8,
            }}>
            Kepemilikan
          </Text>
          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: 22,
              borderCurve: 'continuous',
            }}>
            {HOLDINGS.map((h, i) => (
              <Pressable
                key={h.tick}
                onPress={() => {
                  haptics.tap();
                  router.push('/(app)/aset-detail' as Href);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderBottomWidth: i < HOLDINGS.length - 1 ? 1 : 0,
                  borderBottomColor: palette.inkFaint,
                }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: h.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text
                    color="#fff"
                    style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
                    {h.tick}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="bodySm"
                    numberOfLines={1}
                    style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.2 }}>
                    {h.name.split(' · ')[1] || h.name}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={palette.inkMute}
                    style={{ fontSize: 11, marginTop: 2 }}>
                    {h.name.split(' · ')[0]}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="mono" style={{ fontSize: 13, fontWeight: '500' }}>
                    {rupiah(h.amt, { short: true })}
                  </Text>
                  <Text
                    variant="mono"
                    color={h.ret >= 0 ? palette.cool : palette.coral}
                    style={{ fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                    {h.ret >= 0 ? '+' : ''}
                    {String(h.ret).replace('.', ',')}%
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI nudge */}
        <Pressable
          onPress={() => haptics.tap()}
          style={{
            marginHorizontal: 18,
            marginTop: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: palette.moss,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            overflow: 'hidden',
          }}>
          <Glow
            size={100}
            color={palette.lime}
            opacity={0.18}
            fadeAt={0.7}
            position={{ top: -30, right: -30 }}
          />
          <Icon name="sparkle" size={14} color={palette.lime} />
          <View style={{ flex: 1 }}>
            <Text
              variant="bodySm"
              color={ONDARK}
              style={{ fontSize: 13, fontWeight: '700' }}>
              Porsi pasar uang 47%.
            </Text>
            <Text
              variant="bodySm"
              color="rgba(240,240,232,0.65)"
              style={{ fontSize: 11, marginTop: 2 }}>
              Pertimbangkan tambah saham untuk jangka panjang.
            </Text>
          </View>
          <Icon name="arrowR" size={14} color={palette.lime} />
        </Pressable>
      </Screen>

      <TabBar active="budget" />
    </View>
  );
}
